

# Recovery Key System for V2 Zero-Knowledge Encryption

## Overview

Add a recovery key mechanism so V2 users can regain access to their encrypted letters if they forget their password. The recovery key is a second wrapped copy of the same AES data key, wrapped with a PBKDF2-derived key from a random recovery code instead of the password.

## 1. Database Migration

Add two nullable columns to `user_encryption_keys`:

```text
recovery_wrapped_key  TEXT  (AES data key wrapped with recovery-code-derived key, AES-GCM)
recovery_key_salt     TEXT  (PBKDF2 salt used for the recovery wrapping key)
```

Create a new RPC function `get_recovery_metadata_by_email` (SECURITY DEFINER, same pattern as `get_encryption_metadata_by_email`) that returns `recovery_wrapped_key`, `recovery_key_salt`, and `encryption_version` given an email address. This is needed so the client can attempt unwrapping before authenticating.

## 2. Recovery Encryption Functions

New file: `src/lib/recoveryKey.ts`

- `generateRecoveryCode(): string` -- generates 24 random alphanumeric characters, formatted as `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`
- `wrapKeyWithRecoveryCode(aesKey: CryptoKey, recoveryCode: string): Promise<{ wrappedKeyB64: string, saltB64: string }>` -- derives AES-GCM wrapping key from recovery code via PBKDF2 (310k iterations, SHA-256, fresh 16-byte salt), encrypts the exported AES key with AES-GCM, returns wrapped key + salt
- `unwrapKeyWithRecoveryCode(wrappedKeyB64: string, saltB64: string, recoveryCode: string): Promise<CryptoKey>` -- reverse of above; throws on invalid code
- `storeRecoveryKey(userId: string, wrappedKeyB64: string, saltB64: string): Promise<void>` -- updates `recovery_wrapped_key` and `recovery_key_salt` in DB

## 3. Signup Flow Changes

File: `src/contexts/AuthContext.tsx` (signUp function)

After the existing `createAndStoreWrappedKey` and RSA key generation:
1. Export the AES data key (it's still extractable at this point in the signup flow)
2. Call `generateRecoveryCode()` to create a random code
3. Call `wrapKeyWithRecoveryCode()` to wrap the AES key
4. Call `storeRecoveryKey()` to persist `recovery_wrapped_key` and `recovery_key_salt`
5. Set a state/flag that triggers the Recovery Code Modal to display

New component: `src/components/RecoveryCodeModal.tsx`
- Displays the recovery code in a large, readable, copyable format
- "Copy to clipboard" button
- Checkbox: "I have saved this recovery code"
- "Continue" button (enabled after checkbox)
- If dismissed without checking, show a confirmation dialog warning that the code will never be shown again
- Never blocks signup completion -- just strongly warns

The modal will be triggered from the Auth page after successful signup via a callback/state variable.

## 4. Recovery Flow (Forgot Password Path)

File: `src/pages/Auth.tsx`

Add a new AuthMode: `"recovery"`. On the forgot-password screen, add a link: "Have a recovery key? Use it instead."

The recovery mode UI has three steps:

**Step 1 -- Enter credentials:**
- Email input
- Recovery code input (formatted with dashes)
- "Recover Account" button

**Step 2 -- Set new password (on success):**
- New password input
- Confirm password input
- "Update Password & Generate New Recovery Key" button

**Step 3 -- Show new recovery code:**
- Same modal as signup (`RecoveryCodeModal`)

Under the hood:
1. Fetch `recovery_wrapped_key` and `recovery_key_salt` via `get_recovery_metadata_by_email` RPC
2. Attempt `unwrapKeyWithRecoveryCode()` -- if it fails, show "Invalid recovery code"
3. On success, call `supabase.auth.resetPasswordForEmail()` -- but since we need to set the password programmatically, we use the admin password reset flow: the user enters their new password, then we call `supabase.auth.signInWithPassword` after an admin-level password reset. Actually, since Supabase doesn't allow setting a password without being authenticated, the flow will be:
   - Use `supabase.auth.signInWithPassword` with a temporary mechanism -- but the user forgot their password.
   - Instead: Use `supabase.auth.resetPasswordForEmail()` to send a reset link. When the user returns via the reset link (mode=reset), we detect if they came from recovery, re-prompt for the recovery code, unwrap the key, and then re-wrap with the new password.

**Revised recovery flow (simpler, more secure):**

Since Supabase requires email-based password reset, the recovery key flow enhances the existing reset flow:

1. User clicks "Forgot password?" on sign-in page
2. Existing flow sends reset email, user clicks link, arrives at `?mode=reset`
3. On the reset password page, add: "Do you have a recovery key?" toggle
4. If yes: user enters recovery code alongside new password
5. After `updatePassword()` succeeds, the app:
   - Fetches `recovery_wrapped_key` + `recovery_key_salt` via RPC
   - Unwraps AES key with recovery code
   - Re-wraps AES key with new password (update `wrapped_key`, `salt`)
   - Generates new recovery code, re-wraps AES key, updates `recovery_wrapped_key` and `recovery_key_salt`
   - Shows new recovery code modal
   - Caches the AES key for the session
   - Also re-wraps RSA private key with new password-derived GCM key

This approach leverages the existing Supabase password reset email flow and adds key recovery on top.

## 5. Settings Page

New file: `src/pages/Settings.tsx`

A simple account settings page with a "Recovery Key" section:

- Shows status: "Recovery key is set" or "No recovery key configured"
- "Regenerate Recovery Key" button (requires entering current password)
- On regeneration:
  1. Verify password by deriving wrapping key and attempting to unwrap `wrapped_key`
  2. Export the AES data key
  3. Generate new recovery code
  4. Wrap AES key with new recovery code
  5. Update `recovery_wrapped_key` and `recovery_key_salt` in DB
  6. Show new recovery code in modal
- "Set Up Recovery Key" button (for V2 users without one) -- same flow

Add route `/settings` to `App.tsx` as a protected route. Add "Settings" link to the navbar.

## 6. Backwards Compatibility

- V1 users: completely untouched. No recovery key UI shown.
- V2 users without recovery key: all existing flows work. Settings page shows option to set one up. Recovery toggle on reset page simply isn't available (graceful fallback).
- V2 users with recovery key: full recovery flow available on password reset.
- No existing rows, columns, or tables are modified or deleted.

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/...recovery_key.sql` | Add columns + RPC |
| `src/lib/recoveryKey.ts` | New -- recovery code generation and wrapping |
| `src/components/RecoveryCodeModal.tsx` | New -- one-time code display modal |
| `src/contexts/AuthContext.tsx` | Modify -- generate recovery key at signup, re-wrap on password reset |
| `src/pages/Auth.tsx` | Modify -- add recovery code input on reset mode |
| `src/pages/Settings.tsx` | New -- account settings with recovery key management |
| `src/App.tsx` | Modify -- add `/settings` route |
| `src/components/Navbar.tsx` | Modify -- add Settings link |

## Technical Details

- Recovery code format: 24 alphanumeric chars from `crypto.getRandomValues`, grouped as `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (~143 bits of entropy)
- PBKDF2 parameters: 310,000 iterations, SHA-256, 16-byte random salt (matching existing)
- Wrapping algorithm: AES-GCM (matching RSA private key wrapping pattern, not AES-KW)
- The raw recovery code is never stored anywhere -- only the wrapped output and salt
- The AES data key must be temporarily extractable during wrapping; it is re-imported as non-extractable for session use

