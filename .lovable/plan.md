
## Upgrade to Password-Derived Key Wrapping (v2) — New Users + Silent Migration for Existing Users

### What Changes and Why

Today, every user's AES-GCM key is stored as a raw base64 string in `user_encryption_keys.encrypted_key`. Anyone with database access can read it and decrypt any letter.

The fix: wrap the AES key with a second key derived from the user's own password (PBKDF2 + AES-KW). The wrapped blob is stored instead of the raw key. Without the user's password, the blob is cryptographically useless — even to the platform.

Existing users are silently upgraded to v2 the next time they log in. No notification, no disruption — it just happens in the background with the password they just typed.

---

### Flows

**Sign Up (v2, new users only)**

1. `createAndStoreWrappedKey(userId, password)` runs in the browser immediately after `supabase.auth.signUp()` succeeds
2. Generates a 16-byte random salt
3. Derives a wrapping key (PBKDF2 → AES-KW, 310,000 iterations, SHA-256)
4. Generates a fresh AES-GCM 256-bit key
5. Wraps the AES key with `crypto.subtle.wrapKey` (AES-KW)
6. Stores `wrapped_key`, `salt`, `kdf_iterations=310000`, `encryption_version=2` in the DB — `encrypted_key` left null
7. Caches the AES key in memory for the session
8. If the DB insert fails → calls `supabase.auth.admin.deleteUser()` via a cleanup path to avoid a stranded account with no key. Since we can't call admin APIs from the client, instead we call `supabase.auth.signOut()` and surface an error instructing the user to try again (the account creation is rolled back by signing out and re-attempting, since no key row means the account is in a broken state — we handle this by deleting the partial account using a dedicated edge function called with the user's own token immediately after signup failure)

**Sign In — v2 existing user**

1. Before calling `supabase.auth.signInWithPassword()`, fetch `salt`, `wrapped_key`, `kdf_iterations`, `encryption_version` via `get_encryption_metadata_by_email(email)` DB function
2. If version is 2: derive the wrapping key from the entered password + fetched salt (PBKDF2), then `crypto.subtle.unwrapKey` to get the AES key, cache it
3. Call `supabase.auth.signInWithPassword()` as normal
4. The `SIGNED_IN` event fires → `initializeUserEncryptionKey` is called but finds the key already in cache → returns immediately, no extra DB call

**Sign In — v1 existing user (silent migration)**

1. Fetch metadata via `get_encryption_metadata_by_email` → `encryption_version` is 1 (or row not yet found → treat as v1)
2. Call `supabase.auth.signInWithPassword()` as normal
3. After sign-in succeeds (user is now authenticated), call `migrateToV2(userId, password)`:
   - Fetch `encrypted_key` from DB (user is now authenticated, RLS passes)
   - Import it as an extractable AES-GCM key using `crypto.subtle.importKey` with `extractable: true`
   - Generate a 16-byte random salt
   - Derive a wrapping key (same PBKDF2 process)
   - Wrap the AES key with `crypto.subtle.wrapKey`
   - Update the DB row: write `wrapped_key`, `salt`, `kdf_iterations`, `encryption_version=2`
   - Only after the update succeeds: null out `encrypted_key` in a second update
   - Cache the AES key (non-extractable re-import) — subsequent usage is identical to v2
4. All of this runs in the background — the user is already navigated to the app

The password is available because it was just typed into the sign-in form and passed directly through the call chain. It is used immediately for PBKDF2 and then discarded — never stored in state, localStorage, or any variable that persists beyond the function call.

---

### The Salt Fetch Problem

At sign-in, we need `salt` + `encryption_version` before authentication (to unwrap the key before calling Supabase auth). The user isn't authenticated yet so RLS blocks `SELECT` on `user_encryption_keys`.

**Solution:** A `SECURITY DEFINER` Postgres function `get_encryption_metadata_by_email(email text)` that returns only `(salt, wrapped_key, kdf_iterations, encryption_version)` — no user IDs, no raw keys. This is callable with the anon key. The salt is explicitly not secret (it's a standard PBKDF2 parameter). For v1 users the function returns a row with `encryption_version=1` and null `wrapped_key`/`salt`, which tells the sign-in flow to proceed with the old path and run the silent migration after auth.

---

### Database Changes (one migration)

**Four nullable columns added to `user_encryption_keys`:**

```sql
ALTER TABLE user_encryption_keys
  ADD COLUMN wrapped_key text,
  ADD COLUMN salt text,
  ADD COLUMN kdf_iterations integer,
  ADD COLUMN encryption_version integer DEFAULT 1;
```

Existing rows get `encryption_version=1` automatically via the DEFAULT. No existing data changes.

**RLS policy update:** The existing "Encryption keys cannot be updated" policy is a restrictive (deny) policy with `USING (false)`. Migration requires updating a row. We need to add a permissive UPDATE policy that allows a user to update their own row — but tighten it so they can only set `encryption_version`, `wrapped_key`, `salt`, `kdf_iterations`. Since RLS column-level filtering isn't directly available, the permissive policy will allow the user to update their own row (`auth.uid() = user_id`), and we rely on the application code to only update the permitted columns.

Actually — looking more carefully: the existing restrictive policies use `AS RESTRICTIVE` semantics (they are `Permissive: No` in the schema view, meaning they're restrictive policies). A restrictive `UPDATE` policy with `USING (false)` will block all updates unconditionally. We need to either:
- Remove the restrictive UPDATE policy and add a permissive one scoped to `auth.uid() = user_id`
- Or keep the restrictive policy but narrow its condition

The cleanest approach: replace the restrictive UPDATE policy with a permissive one: `auth.uid() = user_id`. This preserves ownership enforcement while enabling the migration write.

**New DB function:**

```sql
CREATE OR REPLACE FUNCTION public.get_encryption_metadata_by_email(lookup_email text)
RETURNS TABLE(salt text, wrapped_key text, kdf_iterations integer, encryption_version integer)
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
    SELECT uek.salt, uek.wrapped_key, uek.kdf_iterations, uek.encryption_version
    FROM user_encryption_keys uek
    WHERE uek.user_id = found_user_id;
END;
$$;
```

**Cleanup edge function** for stranded accounts (sign-up key storage failure):

A new edge function `delete-own-account` that accepts the user's valid JWT, verifies it, and calls the admin API to delete the auth account. This is the only safe way to delete an account from the client side without exposing the service role key.

---

### Code Changes

**`src/lib/encryption.ts`**

New private functions:
- `deriveWrappingKey(password: string, saltBytes: Uint8Array, iterations: number): Promise<CryptoKey>` — PBKDF2 → AES-KW
- `importAesKeyExtractable(keyString: string): Promise<CryptoKey>` — like `importKey` but `extractable: true`, needed for migration wrapping

New exported functions:
- `createAndStoreWrappedKey(userId: string, password: string): Promise<void>` — full sign-up v2 key creation + DB store. Called after successful sign-up. On DB failure, throws so the caller can handle cleanup.
- `loadAndCacheV2Key(userId: string, wrappedKeyB64: string, saltB64: string, iterations: number, password: string): Promise<void>` — used at sign-in for v2 users. Derives wrapping key, unwraps, caches.
- `migrateV1ToV2(userId: string, password: string): Promise<void>` — fetches `encrypted_key`, wraps it, updates DB, nulls old column, re-caches as non-extractable.

Updated `getOrCreateUserKey`:
- Fetches `encryption_version`, `encrypted_key`, `wrapped_key`, `salt`, `kdf_iterations`
- If version 2: uses `loadAndCacheV2Key` logic (wrapping key derived from... wait — `getOrCreateUserKey` doesn't have access to the password at this call site)
- For v2, the key is always pre-cached before `getOrCreateUserKey` is called (done at sign-in time). So `getOrCreateUserKey` for v2 users will always find the key in cache and return immediately. The fetch-from-DB path in `getOrCreateUserKey` only triggers if the cache is cold, which for v2 users would only happen if the app reloads mid-session — in that case, we can't re-derive without the password. The correct handling: if `encryption_version=2` and cache is cold, the key cannot be recovered without re-authentication. The function should throw a descriptive error that triggers a sign-in prompt. In practice this is very unlikely (page reload during active session triggers `getSession` → `SIGNED_IN` → `initializeUserEncryptionKey` → cache is already warm from the sign-in flow).

Actually for session restores (page reload): `getSession` fires, then `SIGNED_IN` fires via `onAuthStateChange`, which calls `initializeUserEncryptionKey`. But for v2 users we can't re-derive the key without their password — it's gone. This means after a page reload, v2 users would have a cold cache and the old `getOrCreateUserKey` would fail or try to fetch the raw key (which is null for v2 users).

**Solution for page reload / session restore:** If `encryption_version=2` and cache is cold at `getOrCreateUserKey` time → throw a clear error, and `initializeUserEncryptionKey` returns `false`. The `useEncryptionReady` hook detects this and instead of showing "Securing...", triggers a sign-out and redirects to sign-in with a message: "Your session has expired. Please sign in again." This is correct behavior — for zero-knowledge systems, the key genuinely cannot be recovered without re-authentication.

**`src/contexts/AuthContext.tsx`**

`signUp` changes:
1. Call `supabase.auth.signUp()` as now
2. On success (`!error && data.user`): call `createAndStoreWrappedKey(data.user.id, password)`
3. If `createAndStoreWrappedKey` throws: call the `delete-own-account` edge function to remove the stranded auth account, then return an error to the UI
4. On success: the key is already in cache, no need for `initializeUserEncryptionKey` for this user

`signIn` changes:
1. First: call `supabase.rpc('get_encryption_metadata_by_email', { lookup_email: email })` to fetch metadata
2. Parse result: get `encryption_version`, `wrapped_key`, `salt`, `kdf_iterations`
3. If `encryption_version === 2` and `wrapped_key` is present: call `loadAndCacheV2Key(...)` with the plaintext password before proceeding. If unwrap fails (wrong password), the sign-in will also fail — both failures surface the same "Invalid credentials" error.
4. Call `supabase.auth.signInWithPassword()` as normal
5. If sign-in succeeds AND `encryption_version === 1`: fire-and-forget `migrateV1ToV2(userId, password)` — password is still in scope at this point, used immediately, then the closure ends
6. The `SIGNED_IN` handler calls `initializeUserEncryptionKey` — for both v2 and freshly-migrated users the key is already in cache, returns immediately

---

### Files Changed

| File | Change |
|---|---|
| DB Migration (new) | Add 4 columns, update UPDATE policy, add `get_encryption_metadata_by_email` function |
| `supabase/functions/delete-own-account/index.ts` | New edge function: verify JWT, delete own account via admin API |
| `src/lib/encryption.ts` | Add `deriveWrappingKey`, `importAesKeyExtractable`, `createAndStoreWrappedKey`, `loadAndCacheV2Key`, `migrateV1ToV2`; update `getOrCreateUserKey` to handle v2 cold-cache scenario |
| `src/contexts/AuthContext.tsx` | Update `signUp` (call `createAndStoreWrappedKey`, handle failure); update `signIn` (fetch metadata, pre-prime cache for v2, fire-and-forget migrate for v1) |
| `src/hooks/useEncryptionReady.ts` | Handle `initializeUserEncryptionKey` returning false for v2 cold-cache → trigger sign-out |

### Files NOT Changed

- `encryptValue`, `decryptValue`, `encryptLetterFields`, `decryptLetterFields` — no changes
- All letter hooks (`useLetters`, `useDrafts`, `useReencryptForRecipients`) — no changes
- `migrateLegacyEncryption.ts` — no changes
- All RLS policies on `letters` — no changes
- The `reencrypt-for-recipient` edge function — no changes
