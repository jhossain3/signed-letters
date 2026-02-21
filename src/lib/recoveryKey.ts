/**
 * Recovery Key module for V2 zero-knowledge encryption.
 *
 * A recovery code is a random 24-char alphanumeric string (XXXX-XXXX-XXXX-XXXX-XXXX-XXXX).
 * It is run through PBKDF2 (310 000 iterations, SHA-256, fresh 16-byte salt) to derive
 * an AES-GCM wrapping key. The user's AES data key is then encrypted (wrapped) with that
 * derived key. Only the wrapped output + salt are stored — the raw recovery code is never
 * persisted anywhere.
 */

import { supabase } from "@/integrations/supabase/client";

const KDF_ITERATIONS = 310_000;
const IV_LENGTH = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}

function base64ToUint8Array(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ─── Recovery code generation ─────────────────────────────────────────────────

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a cryptographically random 24-character alphanumeric recovery code,
 * formatted as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX for readability.
 */
export function generateRecoveryCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(24));
  const chars = Array.from(values, v => ALPHANUM[v % ALPHANUM.length]);
  // Group into 6 groups of 4
  const groups: string[] = [];
  for (let i = 0; i < 24; i += 4) {
    groups.push(chars.slice(i, i + 4).join(''));
  }
  return groups.join('-');
}

/**
 * Normalise a recovery code: strip dashes/spaces, uppercase.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[-\s]/g, '').toUpperCase();
}

// ─── PBKDF2 → AES-GCM derivation ─────────────────────────────────────────────

async function deriveRecoveryWrappingKey(
  recoveryCode: string,
  saltBytes: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const normalised = normalizeRecoveryCode(recoveryCode);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalised),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Wrap / unwrap ────────────────────────────────────────────────────────────

/**
 * Wrap an AES data key with a recovery-code-derived AES-GCM key.
 * Returns the base64-encoded wrapped key (IV prepended) and salt.
 */
export async function wrapKeyWithRecoveryCode(
  aesKey: CryptoKey,
  recoveryCode: string,
): Promise<{ wrappedKeyB64: string; saltB64: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const wrappingKey = await deriveRecoveryWrappingKey(recoveryCode, saltBytes);

  // Export the AES key as raw bytes
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));

  // Encrypt with AES-GCM (random IV prepended to ciphertext)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    rawKey,
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return {
    wrappedKeyB64: uint8ArrayToBase64(combined),
    saltB64: uint8ArrayToBase64(saltBytes),
  };
}

/**
 * Unwrap an AES data key using a recovery code.
 * Throws on invalid code (decryption failure).
 */
export async function unwrapKeyWithRecoveryCode(
  wrappedKeyB64: string,
  saltB64: string,
  recoveryCode: string,
): Promise<CryptoKey> {
  const saltBytes = base64ToUint8Array(saltB64) as Uint8Array<ArrayBuffer>;
  const wrappingKey = await deriveRecoveryWrappingKey(recoveryCode, saltBytes);

  const combined = base64ToUint8Array(wrappedKeyB64);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const rawKeyBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ciphertext,
  );

  // Import as extractable so it can be re-wrapped with a new password / new recovery code
  return crypto.subtle.importKey(
    'raw',
    rawKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// ─── DB persistence ───────────────────────────────────────────────────────────

/**
 * Store recovery-wrapped key and salt in the database.
 */
export async function storeRecoveryKey(
  userId: string,
  wrappedKeyB64: string,
  saltB64: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_encryption_keys')
    .update({
      recovery_wrapped_key: wrappedKeyB64,
      recovery_key_salt: saltB64,
    } as never)
    .eq('user_id', userId);

  if (error) {
    console.error('[RecoveryKey] Failed to store recovery key:', error);
    throw new Error('Failed to store recovery key');
  }
  console.log('[RecoveryKey] Recovery key stored successfully');
}

/**
 * Fetch recovery metadata for an email (pre-auth, via SECURITY DEFINER RPC).
 */
export async function fetchRecoveryMetadata(email: string): Promise<{
  recoveryWrappedKey: string | null;
  recoveryKeySalt: string | null;
  encryptionVersion: number;
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    'get_recovery_metadata_by_email',
    { lookup_email: email },
  ) as { data: Array<{ recovery_wrapped_key: string; recovery_key_salt: string; encryption_version: number }> | null; error: Error | null };

  if (error || !data || data.length === 0) return null;

  return {
    recoveryWrappedKey: data[0].recovery_wrapped_key,
    recoveryKeySalt: data[0].recovery_key_salt,
    encryptionVersion: data[0].encryption_version,
  };
}

/**
 * Check if the current user has a recovery key set.
 */
export async function hasRecoveryKey(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_encryption_keys')
    .select('recovery_wrapped_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return false;
  return !!(data as never as { recovery_wrapped_key: string | null }).recovery_wrapped_key;
}
