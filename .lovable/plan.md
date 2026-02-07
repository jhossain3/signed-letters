
## Fix: Initialize Encryption Key at Signup

### Problem
When a new user signs up and immediately tries to seal a letter, the encryption fails with "failed to encrypt data". This happens because:
1. The user signs up and gets redirected to the vault
2. They try to seal a letter, which triggers encryption key creation
3. The database RLS policy check (`auth.uid() = user_id`) fails because the server-side session hasn't fully propagated yet

### Solution
Initialize the encryption key **immediately after successful signup**, when the session is guaranteed to be valid on the server side. This ensures the key exists before the user ever tries to seal a letter.

---

## Implementation Steps

### 1. Export the key initialization function from encryption.ts
Make the `getOrCreateUserKey` function available for external use by exporting it as `initializeUserEncryptionKey`.

**File:** `src/lib/encryption.ts`
- Create a new exported function `initializeUserEncryptionKey(userId: string)` that wraps `getOrCreateUserKey`
- Add retry logic with a small delay (500ms retries, 3 attempts) to handle any remaining session propagation edge cases
- Return a success/failure status instead of throwing, so the signup flow can handle it gracefully

### 2. Call key initialization after successful signup
Modify the auth flow to initialize the encryption key right after a successful signup.

**File:** `src/contexts/AuthContext.tsx`
- Import the new `initializeUserEncryptionKey` function
- In the `onAuthStateChange` listener, when the event is `SIGNED_IN` and this is a new session, trigger key initialization in the background
- Use a non-blocking approach so key creation doesn't delay the user's navigation

### 3. Add fallback in encryption flow
Keep the existing `getOrCreateUserKey` logic as a fallback for:
- Users who signed up before this fix
- Edge cases where background initialization failed

---

## Technical Details

### New exported function in encryption.ts
```typescript
export async function initializeUserEncryptionKey(userId: string): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // ms
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await getOrCreateUserKey(userId);
      console.log('[Encryption] User key initialized successfully');
      return true;
    } catch (error) {
      console.warn(`[Encryption] Key init attempt ${attempt + 1} failed:`, error);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  }
  console.error('[Encryption] Failed to initialize user key after retries');
  return false;
}
```

### AuthContext.tsx changes
```typescript
import { clearKeyCache, initializeUserEncryptionKey } from "@/lib/encryption";

// In onAuthStateChange:
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
  setIsLoading(false);
  
  // Initialize encryption key for new sign-ins
  if (event === 'SIGNED_IN' && session?.user) {
    // Fire and forget - don't block the UI
    initializeUserEncryptionKey(session.user.id).catch(console.error);
  }
});
```

---

## Benefits
1. **Eliminates the race condition** - Key is created when session is fresh
2. **Non-blocking** - Users aren't delayed while key is created
3. **Retry logic** - Handles transient failures gracefully
4. **Backward compatible** - Existing users without keys still get them on first encryption
5. **Simple change** - Minimal code modification, easy to test
