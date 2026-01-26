// Client-side encryption using Web Crypto API
// Uses AES-GCM for symmetric encryption with user-specific keys
// Key is derived from user email (NOT stored in letters table) for security

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// Cache derived keys to avoid re-deriving on every operation
const keyCache = new Map<string, CryptoKey>();

/**
 * Derive a consistent encryption key from user email
 * Email is used instead of userId because userId is stored in the letters table,
 * making it visible alongside encrypted data. Email is only in auth.users (RLS protected).
 */
async function deriveKey(userEmail: string): Promise<CryptoKey> {
  // Check cache first
  const cached = keyCache.get(userEmail);
  if (cached) return cached;

  const encoder = new TextEncoder();
  
  // Use email as the key material - it's private and not stored with letter data
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userEmail.toLowerCase().trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Salt combines app identifier with a version for future key rotation if needed
  const salt = encoder.encode('signed-letters-v2-email-derived-key');

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  // Cache the key
  keyCache.set(userEmail, key);
  
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
export async function encryptValue(value: string, userEmail: string): Promise<string> {
  if (!value) return value;
  
  try {
    const key = await deriveKey(userEmail);
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
export async function decryptValue(encryptedValue: string, userEmail: string): Promise<string> {
  if (!encryptedValue) return encryptedValue;
  
  // Check if the value is encrypted (has the 'enc:' prefix)
  if (!encryptedValue.startsWith('enc:')) {
    // Return as-is for legacy unencrypted data
    return encryptedValue;
  }
  
  try {
    const key = await deriveKey(userEmail);
    
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
  userEmail: string
): Promise<{ title: string; body: string | null; signature: string; sketchData?: string }> {
  const [encryptedTitle, encryptedBody, encryptedSignature, encryptedSketchData] = await Promise.all([
    encryptValue(letter.title, userEmail),
    letter.body ? encryptValue(letter.body, userEmail) : Promise.resolve(null),
    encryptValue(letter.signature, userEmail),
    letter.sketchData ? encryptValue(letter.sketchData, userEmail) : Promise.resolve(undefined),
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
  userEmail: string
): Promise<T> {
  const [decryptedTitle, decryptedBody, decryptedSignature, decryptedSketchData] = await Promise.all([
    decryptValue(letter.title, userEmail),
    letter.body ? decryptValue(letter.body, userEmail) : Promise.resolve(null),
    decryptValue(letter.signature, userEmail),
    letter.sketchData ? decryptValue(letter.sketchData, userEmail) : Promise.resolve(undefined),
  ]);
  
  return {
    ...letter,
    title: decryptedTitle,
    body: decryptedBody,
    signature: decryptedSignature,
    sketchData: decryptedSketchData,
  };
}
