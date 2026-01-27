// Client-side encryption using Web Crypto API
// Uses AES-GCM for symmetric encryption with randomly generated keys
// Keys are stored encrypted in Supabase (encrypted at rest)

import { supabase } from "@/integrations/supabase/client";

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// Cache derived keys to avoid re-fetching on every operation
const keyCache = new Map<string, CryptoKey>();

/**
 * Generate a new random encryption key
 */
async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable for storage
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
 * Import a base64 string back to CryptoKey
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
 * Get or create the encryption key for a user
 * Keys are stored in Supabase and encrypted at rest
 */
async function getOrCreateUserKey(userId: string): Promise<CryptoKey> {
  // Check cache first
  const cached = keyCache.get(userId);
  if (cached) return cached;

  // Try to fetch existing key from database
  const { data: existingKey, error: fetchError } = await supabase
    .from('user_encryption_keys')
    .select('encrypted_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching encryption key:', fetchError);
    throw new Error('Failed to retrieve encryption key');
  }

  let key: CryptoKey;

  if (existingKey) {
    // Import existing key
    key = await importKey(existingKey.encrypted_key);
  } else {
    // Generate new key for this user
    key = await generateEncryptionKey();
    const exportedKey = await exportKey(key);

    // Store the key in database (encrypted at rest by Supabase)
    const { error: insertError } = await supabase
      .from('user_encryption_keys')
      .insert({
        user_id: userId,
        encrypted_key: exportedKey,
      });

    if (insertError) {
      console.error('Error storing encryption key:', insertError);
      throw new Error('Failed to store encryption key');
    }
    
    // Re-import as non-extractable for security
    key = await importKey(exportedKey);
  }

  // Cache the key
  keyCache.set(userId, key);
  
  return key;
}

/**
 * Clear the key cache (call on logout)
 */
export function clearKeyCache(): void {
  keyCache.clear();
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
