// Client-side encryption using Web Crypto API
// Uses AES-GCM for symmetric encryption with user-specific keys

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// Derive a consistent encryption key from user ID
async function deriveKey(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Use a fixed salt derived from the app name for consistency
  const salt = encoder.encode('signed-letters-encryption-salt-v1');

  return crypto.subtle.deriveKey(
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
}

// Encrypt a string value
export async function encryptValue(value: string, userId: string): Promise<string> {
  if (!value) return value;
  
  try {
    const key = await deriveKey(userId);
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
    return 'enc:' + btoa(String.fromCharCode(...combined));
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
    const key = await deriveKey(userId);
    
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
  letter: { title: string; body: string | null; signature: string },
  userId: string
): Promise<{ title: string; body: string | null; signature: string }> {
  const [encryptedTitle, encryptedBody, encryptedSignature] = await Promise.all([
    encryptValue(letter.title, userId),
    letter.body ? encryptValue(letter.body, userId) : Promise.resolve(null),
    encryptValue(letter.signature, userId),
  ]);
  
  return {
    title: encryptedTitle,
    body: encryptedBody,
    signature: encryptedSignature,
  };
}

// Decrypt multiple fields in a letter object
export async function decryptLetterFields<T extends { title: string; body: string | null; signature: string }>(
  letter: T,
  userId: string
): Promise<T> {
  const [decryptedTitle, decryptedBody, decryptedSignature] = await Promise.all([
    decryptValue(letter.title, userId),
    letter.body ? decryptValue(letter.body, userId) : Promise.resolve(null),
    decryptValue(letter.signature, userId),
  ]);
  
  return {
    ...letter,
    title: decryptedTitle,
    body: decryptedBody,
    signature: decryptedSignature,
  };
}
