// Email-derived encryption for "someone else" letters
// Derives a deterministic AES-GCM key from the recipient's email address
// so that anyone who authenticates with that email can decrypt

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
// Fixed salt for email-derived keys (deterministic derivation)
const EMAIL_KEY_SALT = new TextEncoder().encode('signed-letters-email-derived-key-v1');

/**
 * Derive an AES-256-GCM key deterministically from an email address.
 * Uses PBKDF2 with a fixed salt so the same email always produces the same key.
 */
async function deriveKeyFromEmail(email: string): Promise<CryptoKey> {
  const normalizedEmail = email.trim().toLowerCase();
  const emailBytes = new TextEncoder().encode(normalizedEmail);

  // Import email as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    emailBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: EMAIL_KEY_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// Cache derived keys to avoid re-deriving
const emailKeyCache = new Map<string, CryptoKey>();

async function getEmailKey(email: string): Promise<CryptoKey> {
  const normalized = email.trim().toLowerCase();
  const cached = emailKeyCache.get(normalized);
  if (cached) return cached;

  const key = await deriveKeyFromEmail(normalized);
  emailKeyCache.set(normalized, key);
  return key;
}

export function clearEmailKeyCache(): void {
  emailKeyCache.clear();
}

// Helper to convert Uint8Array to base64 without stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}

/**
 * Encrypt a string value with a key derived from the recipient's email.
 */
export async function encryptForRecipient(value: string, recipientEmail: string): Promise<string> {
  if (!value) return value;

  const key = await getEmailKey(recipientEmail);
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return 'enc:' + uint8ArrayToBase64(combined);
}

/**
 * Decrypt a string value with a key derived from the user's email.
 */
export async function decryptForRecipient(encryptedValue: string, email: string): Promise<string> {
  if (!encryptedValue) return encryptedValue;
  if (!encryptedValue.startsWith('enc:')) return encryptedValue;

  try {
    const key = await getEmailKey(email);
    const combined = Uint8Array.from(atob(encryptedValue.slice(4)), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Email-derived decryption failed:', error);
    return '[Unable to decrypt]';
  }
}

/**
 * Encrypt all letter content fields for the recipient using their email-derived key.
 */
export async function encryptLetterFieldsForRecipient(
  letter: { title: string; body: string | null; signature: string; sketchData?: string },
  recipientEmail: string
): Promise<{ title: string; body: string | null; signature: string; sketchData?: string }> {
  const [title, body, signature, sketchData] = await Promise.all([
    encryptForRecipient(letter.title, recipientEmail),
    letter.body ? encryptForRecipient(letter.body, recipientEmail) : Promise.resolve(null),
    encryptForRecipient(letter.signature, recipientEmail),
    letter.sketchData ? encryptForRecipient(letter.sketchData, recipientEmail) : Promise.resolve(undefined),
  ]);

  return { title, body, signature, sketchData };
}

/**
 * Decrypt all recipient letter content fields using the user's email.
 */
export async function decryptLetterFieldsForRecipient<T extends { title: string; body: string | null; signature: string; sketchData?: string }>(
  letter: T,
  email: string
): Promise<T> {
  const [title, body, signature, sketchData] = await Promise.all([
    decryptForRecipient(letter.title, email),
    letter.body ? decryptForRecipient(letter.body, email) : Promise.resolve(null),
    decryptForRecipient(letter.signature, email),
    letter.sketchData ? decryptForRecipient(letter.sketchData, email) : Promise.resolve(undefined),
  ]);

  return { ...letter, title, body, signature, sketchData };
}
