// Client-side encryption using Web Crypto API
// Uses AES-GCM for symmetric encryption with randomly generated keys
// Keys are stored encrypted in Supabase (encrypted at rest)
//
// V2: Keys are wrapped using AES-KW with a key derived from the user's password
// via PBKDF2. The server never sees the raw AES key.

import { supabase } from "@/integrations/supabase/client";

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// PBKDF2 parameters for password-derived wrapping key
const KDF_ITERATIONS = 310_000;

// Cache derived keys to avoid re-fetching on every operation
const keyCache = new Map<string, CryptoKey>();

// ─── Low-level helpers ────────────────────────────────────────────────────────

/**
 * Generate a new random encryption key
 */
async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable for storage / wrapping
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to base64 string for storage
 */
async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return uint8ArrayToBase64(new Uint8Array(exported));
}

/**
 * Import a base64 string back to CryptoKey (non-extractable)
 */
async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable after import
    ['encrypt', 'decrypt']
  );
}

/**
 * Import a base64 string back to CryptoKey (extractable — needed for wrapKey)
 */
async function importAesKeyExtractable(keyString: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable so we can wrap it
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive an AES-KW wrapping key from a password + salt using PBKDF2.
 * The password and wrapping key are never stored or sent anywhere.
 */
async function deriveWrappingKey(password: string, saltBytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

// ─── V2 public functions ──────────────────────────────────────────────────────

/**
 * Create a new AES key, wrap it with the user's password, and store it in DB.
 * Called once at signup. Throws on DB failure so the caller can roll back.
 */
export async function createAndStoreWrappedKey(userId: string, password: string): Promise<void> {
  // 1. Generate salt + wrapping key from password
  const saltBytes = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const wrappingKey = await deriveWrappingKey(password, saltBytes);

  // 2. Generate fresh AES-GCM key (extractable so we can wrapKey)
  const aesKey = await generateEncryptionKey(); // extractable = true

  // 3. Wrap the AES key
  const wrappedKeyBuffer = await crypto.subtle.wrapKey('raw', aesKey, wrappingKey, 'AES-KW');
  const wrappedKeyB64 = uint8ArrayToBase64(new Uint8Array(wrappedKeyBuffer));
  const saltB64 = uint8ArrayToBase64(saltBytes);

  // 4. Store in DB — encrypted_key is left null for v2 users
  const { error } = await supabase
    .from('user_encryption_keys')
    .insert({
      user_id: userId,
      wrapped_key: wrappedKeyB64,
      salt: saltB64,
      encryption_version: 2,
      encrypted_key: null,
    } as never);

  if (error) {
    console.error('[Encryption] Failed to store wrapped key:', error);
    throw new Error('Failed to store encryption key');
  }

  // 5. Cache the raw AES key (non-extractable) for this session
  const sessionKey = await importKey(await exportKey(aesKey));
  keyCache.set(userId, sessionKey);

  console.log('[Encryption] V2 key created and stored for user');
}

/**
 * Unwrap the AES key from the stored blob using the user's password,
 * then cache it for this session.
 * Called at sign-in for v2 users.
 */
export async function loadAndCacheV2Key(
  userId: string,
  wrappedKeyB64: string,
  saltB64: string,
  password: string
): Promise<void> {
  const saltBytes = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const wrappedKeyBytes = Uint8Array.from(atob(wrappedKeyB64), c => c.charCodeAt(0));

  const wrappingKey = await deriveWrappingKey(password, saltBytes);

  const aesKey = await crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBytes,
    wrappingKey,
    'AES-KW',
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // non-extractable for session security
    ['encrypt', 'decrypt']
  );

  keyCache.set(userId, aesKey);
  console.log('[Encryption] V2 key unwrapped and cached');
}

/**
 * Optimistically unwrap the AES key from a stored blob using the user's password.
 * Returns the raw CryptoKey WITHOUT caching it (we don't have the userId yet).
 * Call cacheRawKey(userId, key) after auth succeeds to put it in cache.
 */
export async function unwrapV2KeyOptimistic(
  wrappedKeyB64: string,
  saltB64: string,
  password: string
): Promise<CryptoKey> {
  const saltBytes = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const wrappedKeyBytes = Uint8Array.from(atob(wrappedKeyB64), c => c.charCodeAt(0));

  const wrappingKey = await deriveWrappingKey(password, saltBytes);

  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBytes,
    wrappingKey,
    'AES-KW',
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cache a pre-unwrapped key under a user ID.
 */
export function cacheRawKey(userId: string, key: CryptoKey): void {
  keyCache.set(userId, key);
}

/**
 * Silently migrate a v1 user to v2 on their next login.
 * The password is used immediately for PBKDF2 and never stored.
 * On any failure the user retains their v1 key — migration retries next login.
 */
export async function migrateV1ToV2(userId: string, password: string): Promise<void> {
  try {
    // 1. Fetch the existing raw v1 key
    const { data, error: fetchError } = await supabase
      .from('user_encryption_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError || !data?.encrypted_key) {
      console.warn('[Encryption] V1 migration: could not fetch encrypted_key', fetchError);
      return;
    }

    // 2. Import as extractable so we can wrapKey
    const aesKey = await importAesKeyExtractable(data.encrypted_key);

    // 3. Derive wrapping key from password + fresh salt
    const saltBytes = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
    const wrappingKey = await deriveWrappingKey(password, saltBytes);

    // 4. Wrap the AES key
    const wrappedKeyBuffer = await crypto.subtle.wrapKey('raw', aesKey, wrappingKey, 'AES-KW');
    const wrappedKeyB64 = uint8ArrayToBase64(new Uint8Array(wrappedKeyBuffer));
    const saltB64 = uint8ArrayToBase64(saltBytes);

    // 5. Write wrapped_key + salt to DB
    const { error: updateError } = await supabase
      .from('user_encryption_keys')
      .update({ wrapped_key: wrappedKeyB64, salt: saltB64 } as never)
      .eq('user_id', userId);

    if (updateError) {
      console.warn('[Encryption] V1 migration: update failed', updateError);
      return;
    }

    // 6. Read back and verify wrapped_key is present
    const { data: verified, error: verifyError } = await supabase
      .from('user_encryption_keys')
      .select('wrapped_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (verifyError || !verified?.wrapped_key) {
      console.warn('[Encryption] V1 migration: verification failed — keeping v1 key');
      return;
    }

    // 7. Only now: promote to v2 and null out the raw key
    const { error: promoteError } = await supabase
      .from('user_encryption_keys')
      .update({ encryption_version: 2, encrypted_key: null } as never)
      .eq('user_id', userId);

    if (promoteError) {
      console.warn('[Encryption] V1 migration: promote step failed', promoteError);
      return;
    }

    // 8. Re-import as non-extractable and cache
    const sessionKey = await importKey(data.encrypted_key);
    keyCache.set(userId, sessionKey);

    console.log('[Encryption] V1 → V2 migration completed successfully');
  } catch (err) {
    // Migration failure is non-fatal — user retains v1 key, retries next login
    console.warn('[Encryption] V1 migration: unexpected error', err);
  }
}

// ─── Core key retrieval ───────────────────────────────────────────────────────

/**
 * Get the encryption key for a user.
 * - V2 users: key must already be in cache (loaded at sign-in). If not, throws
 *   V2_KEY_REQUIRES_REAUTH so the caller can sign out and redirect to login.
 * - V1 users: fetch encrypted_key from DB and import it (legacy path).
 * - New users (no row): create a v1 key for backward compat (should not happen
 *   for new signups which go through createAndStoreWrappedKey).
 */
async function getOrCreateUserKey(userId: string): Promise<CryptoKey> {
  // Check cache first
  const cached = keyCache.get(userId);
  if (cached) return cached;

  // Fetch row to determine version
  const { data: row, error: fetchError } = await supabase
    .from('user_encryption_keys')
    .select('encrypted_key, encryption_version, wrapped_key, salt')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[Encryption] Error fetching encryption key:', fetchError);
    throw new Error('Failed to retrieve encryption key');
  }

  // V2 user with cold cache — cannot re-derive without password
  if (row && (row as never as { encryption_version: number }).encryption_version === 2) {
    throw new Error('V2_KEY_REQUIRES_REAUTH');
  }

  let key: CryptoKey;

  if (row?.encrypted_key) {
    // V1: import existing raw key
    key = await importKey(row.encrypted_key);
  } else {
    // No row at all — generate a new v1 key (legacy fallback, should be rare)
    key = await generateEncryptionKey();
    const exportedKey = await exportKey(key);

    const { error: insertError } = await supabase
      .from('user_encryption_keys')
      .insert({
        user_id: userId,
        encrypted_key: exportedKey,
      });

    if (insertError) {
      console.error('[Encryption] Error storing encryption key:', insertError);
      throw new Error('Failed to store encryption key');
    }

    key = await importKey(exportedKey);
  }

  keyCache.set(userId, key);
  return key;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Clear the key cache (call on logout)
 */
export function clearKeyCache(): void {
  keyCache.clear();
}

/**
 * Initialize the encryption key for a user with retry logic.
 * For v1 users this fetches/creates the key.
 * For v2 users the key should already be in cache from sign-in.
 * Returns true if successful, false if all retries failed.
 */
export async function initializeUserEncryptionKey(userId: string): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // ms

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await getOrCreateUserKey(userId);
      console.log('[Encryption] User key initialized successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'V2_KEY_REQUIRES_REAUTH') {
        // Propagate this signal — do not retry
        throw error;
      }
      console.warn(`[Encryption] Key init attempt ${attempt + 1} failed:`, error);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  }
  console.error('[Encryption] Failed to initialize user key after retries');
  return false;
}

// Helper to convert Uint8Array to base64 without stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks to avoid call stack issues
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}

// Encrypt a string value
export async function encryptValue(value: string, userId: string): Promise<string> {
  if (!value) return value;

  try {
    const key = await getOrCreateUserKey(userId);
    const encoder = new TextEncoder();
    const data = encoder.encode(value);

    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    // Combine IV and encrypted data, then encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Prefix with 'enc:' to identify encrypted values
    return 'enc:' + uint8ArrayToBase64(combined);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt a string value
export async function decryptValue(encryptedValue: string, userId: string): Promise<string> {
  if (!encryptedValue) return encryptedValue;

  // Check if the value is encrypted (has the 'enc:' prefix)
  if (!encryptedValue.startsWith('enc:')) {
    // Return as-is for legacy unencrypted data
    return encryptedValue;
  }

  try {
    const key = await getOrCreateUserKey(userId);

    // Remove the 'enc:' prefix and decode from base64
    const combined = Uint8Array.from(atob(encryptedValue.slice(4)), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return placeholder for corrupted data
    return '[Unable to decrypt]';
  }
}

// Encrypt multiple fields in an object
export async function encryptLetterFields(
  letter: { title: string; body: string | null; signature: string; sketchData?: string },
  userId: string
): Promise<{ title: string; body: string | null; signature: string; sketchData?: string }> {
  const [encryptedTitle, encryptedBody, encryptedSignature, encryptedSketchData] = await Promise.all([
    encryptValue(letter.title, userId),
    letter.body ? encryptValue(letter.body, userId) : Promise.resolve(null),
    encryptValue(letter.signature, userId),
    letter.sketchData ? encryptValue(letter.sketchData, userId) : Promise.resolve(undefined),
  ]);

  return {
    title: encryptedTitle,
    body: encryptedBody,
    signature: encryptedSignature,
    sketchData: encryptedSketchData,
  };
}

// Decrypt multiple fields in a letter object
export async function decryptLetterFields<T extends { title: string; body: string | null; signature: string; sketchData?: string }>(
  letter: T,
  userId: string
): Promise<T> {
  const [decryptedTitle, decryptedBody, decryptedSignature, decryptedSketchData] = await Promise.all([
    decryptValue(letter.title, userId),
    letter.body ? decryptValue(letter.body, userId) : Promise.resolve(null),
    decryptValue(letter.signature, userId),
    letter.sketchData ? decryptValue(letter.sketchData, userId) : Promise.resolve(undefined),
  ]);

  return {
    ...letter,
    title: decryptedTitle,
    body: decryptedBody,
    signature: decryptedSignature,
    sketchData: decryptedSketchData,
  };
}
