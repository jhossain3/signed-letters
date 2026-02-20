
## V2 Password-Derived Key Wrapping — Implementation Plan

### What is changing and why

The `user_encryption_keys` table currently stores each user's AES-GCM key as a raw base64 string (`encrypted_key`). Anyone with database access can read these keys and decrypt every letter.

The fix wraps the AES key with a second key that is derived from the user's own password using PBKDF2 + AES-KW — all in the browser. The server only ever sees a wrapped blob and a salt. Without the user's password, the blob is cryptographically opaque.

Existing users and their existing data are untouched until their next login, at which point they are silently migrated.

---

### 1. Database Migration

One migration file adds three nullable columns and makes the necessary policy/function changes:

**New columns on `user_encryption_keys`:**
```sql
ALTER TABLE user_encryption_keys
  ADD COLUMN wrapped_key text,
  ADD COLUMN salt text,
  ADD COLUMN encryption_version integer DEFAULT 1;
```
Existing rows automatically get `encryption_version = 1` — no data is altered.

**RLS policy change — allow UPDATE for own row:**
The existing `"Encryption keys cannot be updated"` policy is a restrictive policy with `USING (false)`. This blocks all updates unconditionally, which prevents the migration write. The plan is to:
- Drop the restrictive UPDATE policy
- Add a permissive UPDATE policy: `USING (auth.uid() = user_id)`

This still enforces ownership — users can only update their own row.

**New `SECURITY DEFINER` function** to fetch KDF parameters before authentication (pre-auth, so RLS would otherwise block the read):
```sql
CREATE OR REPLACE FUNCTION public.get_encryption_metadata_by_email(lookup_email text)
RETURNS TABLE(salt text, wrapped_key text, encryption_version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  SELECT id INTO found_user_id FROM auth.users WHERE email = lookup_email LIMIT 1;
  IF found_user_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT uek.salt, uek.wrapped_key, uek.encryption_version
    FROM user_encryption_keys uek
    WHERE uek.user_id = found_user_id;
END;
$$;
```

This returns only non-secret KDF parameters (salt is not secret by PBKDF2 design). No raw keys or user IDs are exposed.

---

### 2. New Edge Function: `delete-own-account`

If signup succeeds but storing the wrapped key fails, the user account exists with no encryption key — a permanently broken state. This edge function allows the client to roll back the auth account using the user's own JWT (no service role key needed on the client):

```
supabase/functions/delete-own-account/index.ts
```

- Accepts the user's Bearer token
- Verifies the JWT and extracts the user ID
- Calls `supabase.auth.admin.deleteUser(userId)` using the service role key (already available as `SUPABASE_SERVICE_ROLE_KEY` secret)
- Returns 200 on success

---

### 3. `src/lib/encryption.ts` — New Functions

**Private helpers (not exported):**

- `deriveWrappingKey(password: string, saltBytes: Uint8Array): Promise<CryptoKey>`
  - Encodes password as UTF-8
  - Imports as PBKDF2 key material
  - Calls `crypto.subtle.deriveKey` with `{ name: 'PBKDF2', salt: saltBytes, iterations: KDF_ITERATIONS, hash: 'SHA-256' }` → `{ name: 'AES-KW', length: 256 }`
  - `KDF_ITERATIONS = 310_000` defined as a module-level constant

- `importAesKeyExtractable(keyString: string): Promise<CryptoKey>`
  - Same as existing `importKey` but with `extractable: true` — needed so the existing v1 raw key can be fed into `wrapKey` during migration

**New exported functions:**

- `createAndStoreWrappedKey(userId: string, password: string): Promise<void>`
  - Generates 16-byte random salt (`crypto.getRandomValues`)
  - Calls `deriveWrappingKey(password, salt)`
  - Generates a fresh AES-GCM 256-bit key (extractable)
  - Calls `crypto.subtle.wrapKey('raw', aesKey, wrappingKey, 'AES-KW')`
  - Encodes both as base64
  - Inserts into `user_encryption_keys`: `{ user_id, salt, wrapped_key, encryption_version: 2 }` — `encrypted_key` left null (the column is currently `NOT NULL DEFAULT ''` — need to check the migration handles making it nullable, or we insert an empty string placeholder that the v1 read path will never touch for v2 users)
  - Re-imports AES key as non-extractable and caches it in `keyCache`
  - Throws on DB failure so the caller can clean up

- `loadAndCacheV2Key(userId: string, wrappedKeyB64: string, saltB64: string, password: string): Promise<void>`
  - Decodes salt and wrapped blob from base64
  - Calls `deriveWrappingKey(password, saltBytes)`
  - Calls `crypto.subtle.unwrapKey('raw', wrappedKeyBytes, wrappingKey, 'AES-KW', { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])`
  - Caches the resulting non-extractable AES key in `keyCache`

- `migrateV1ToV2(userId: string, password: string): Promise<void>`
  - Fetches `encrypted_key` from DB (user is authenticated, RLS passes)
  - Calls `importAesKeyExtractable(encrypted_key)` to get extractable AES key
  - Generates 16-byte random salt
  - Calls `deriveWrappingKey(password, salt)`
  - Calls `crypto.subtle.wrapKey('raw', aesKey, wrappingKey, 'AES-KW')`
  - Updates the DB row: writes `wrapped_key`, `salt`
  - Reads the row back to verify `wrapped_key` is present and non-null
  - Only if verified: updates `encryption_version = 2` and sets `encrypted_key` to null in a second update
  - Re-imports AES key as non-extractable and caches it
  - Any failure is caught and logged — the user still has their v1 key intact, migration will retry next login

**Updated `getOrCreateUserKey`:**

- Now fetches `encryption_version`, `encrypted_key`, `wrapped_key`, `salt` from the row
- If `encryption_version === 2` and cache is cold: throws a clear error `"V2_KEY_REQUIRES_REAUTH"` — this signals the hook to sign out
- If `encryption_version === 1`: follows the existing path using `encrypted_key`
- In practice, for v2 users the key is always pre-cached at sign-in before this is ever called, so the cold-cache error path only triggers on unexpected page reloads where the session restored but no password is available

**Note on `encrypted_key` column nullability:**
The column is currently `NOT NULL`. The migration must alter it to `NULLABLE`:
```sql
ALTER TABLE user_encryption_keys ALTER COLUMN encrypted_key DROP NOT NULL;
```

---

### 4. `src/contexts/AuthContext.tsx` — Updated `signUp` and `signIn`

**`signUp(email, password)`:**

1. Call `supabase.auth.signUp()` as before
2. On success (`data.user` present, no error):
   - Wrap in try/catch:
     - Call `createAndStoreWrappedKey(data.user.id, password)`
     - If it throws: call the `delete-own-account` edge function with the user's access token, then sign out, then return an error to the UI: `"Account setup failed. Please try signing up again."`
3. On success: key is in cache, `initializeUserEncryptionKey` will find it immediately

**`signIn(email, password)`:**

1. Call `supabase.rpc('get_encryption_metadata_by_email', { lookup_email: email })`
2. Parse result: `{ salt, wrapped_key, encryption_version }`
   - If no row found (first-ever login edge case): treat as v1
3. If `encryption_version === 2` and `wrapped_key` is present:
   - Call `loadAndCacheV2Key(userId_placeholder, wrapped_key, salt, password)` — note: we don't have the userId yet, so we store temporarily keyed by email and re-key after auth, OR we call `loadAndCacheV2Key` after sign-in succeeds when we have the user ID. Since `signInWithPassword` will either succeed or fail — if password is wrong, both the unwrap and the auth call will fail. We can do the unwrap optimistically, then key the cache by user ID after auth succeeds.
   - Actually the cleanest approach: call `loadAndCacheV2KeyOptimistic(wrappedKeyB64, saltB64, password)` which returns the raw `CryptoKey` without caching it. After `signInWithPassword` succeeds and we have `data.user.id`, we put it into cache with the correct key.
4. Call `supabase.auth.signInWithPassword({ email, password })` as normal
5. After sign-in succeeds:
   - If v2: put the unwrapped AES key into cache under `data.user.id`
   - If v1: fire-and-forget `migrateV1ToV2(data.user.id, password)` — the password is still in scope at this closure, used immediately for PBKDF2, then the function returns and the closure ends. The password is never stored in state, refs, localStorage, or any persistent variable.

---

### 5. `src/hooks/useEncryptionReady.ts` — Handle V2 Cold-Cache

When `initializeUserEncryptionKey` returns `false` for a v2 user (cold cache after page reload), the current hook sets an error string. The updated behavior:
- Detect the `"V2_KEY_REQUIRES_REAUTH"` error signal
- Call `signOut()` from `useAuth`
- The sign-out will redirect the user to `/auth` where they can log in again and re-derive their key

This is correct security behavior — for a zero-knowledge system the key genuinely cannot be recovered without re-authentication.

---

### Files Changed

| File | Change |
|---|---|
| New DB migration | Add `wrapped_key`, `salt`, `encryption_version` columns; make `encrypted_key` nullable; drop restrictive UPDATE policy; add permissive UPDATE policy; add `get_encryption_metadata_by_email` function |
| `supabase/functions/delete-own-account/index.ts` | New edge function for signup rollback |
| `src/lib/encryption.ts` | Add `KDF_ITERATIONS`, `deriveWrappingKey`, `importAesKeyExtractable`, `createAndStoreWrappedKey`, `loadAndCacheV2Key`, `migrateV1ToV2`; update `getOrCreateUserKey` |
| `src/contexts/AuthContext.tsx` | Update `signUp` (wrapped key creation + rollback); update `signIn` (metadata fetch, pre-prime cache, fire-and-forget migrate) |
| `src/hooks/useEncryptionReady.ts` | Sign out on v2 cold-cache failure |

### Files NOT Changed

- `encryptValue`, `decryptValue`, `encryptLetterFields`, `decryptLetterFields` — unchanged
- All letter hooks — unchanged
- `migrateLegacyEncryption.ts` — unchanged
- All letters RLS policies — unchanged
- The `reencrypt-for-recipient` edge function — unchanged
