/**
 * RSA-OAEP envelope encryption for sending letters to other users.
 *
 * Each letter to another user is encrypted with a fresh one-time AES-GCM key.
 * That key is then wrapped (encrypted) with both the sender's and recipient's
 * RSA public keys, so both parties can decrypt it independently.
 *
 * RSA private keys are wrapped client-side using AES-GCM with the same
 * PBKDF2-derived wrapping key used for the AES data key (same salt).
 *
 * Zero-knowledge is maintained: the server never sees raw keys or plaintext.
 */

import { supabase } from "@/integrations/supabase/client";

const RSA_ALGORITHM = "RSA-OAEP";
const RSA_HASH = "SHA-256";
const RSA_MODULUS_LENGTH = 4096;

const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;

// ─── RSA key cache (per-session, cleared on logout) ──────────────────────────

let cachedRsaPrivateKey: CryptoKey | null = null;
let cachedRsaPublicKey: CryptoKey | null = null;

export function cacheRsaKeys(privateKey: CryptoKey, publicKey: CryptoKey): void {
  cachedRsaPrivateKey = privateKey;
  cachedRsaPublicKey = publicKey;
}

export function getCachedRsaPrivateKey(): CryptoKey | null {
  return cachedRsaPrivateKey;
}

export function getCachedRsaPublicKey(): CryptoKey | null {
  return cachedRsaPublicKey;
}

export function clearRsaKeyCache(): void {
  cachedRsaPrivateKey = null;
  cachedRsaPublicKey = null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}

function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes as Uint8Array<ArrayBuffer>;
}

// ─── RSA key generation ──────────────────────────────────────────────────────

/**
 * Generate a 4096-bit RSA-OAEP key pair for envelope encryption.
 */
export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: RSA_ALGORITHM,
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: RSA_HASH,
    },
    true, // extractable for wrapping/export
    ["wrapKey", "unwrapKey"]
  );
}

/**
 * Export RSA public key as base64-encoded SPKI for storage.
 */
export async function exportRsaPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  return uint8ArrayToBase64(new Uint8Array(exported));
}

/**
 * Import an RSA public key from base64-encoded SPKI.
 */
export async function importRsaPublicKey(b64: string): Promise<CryptoKey> {
  const keyData = base64ToUint8Array(b64);
  return crypto.subtle.importKey(
    "spki",
    keyData,
    { name: RSA_ALGORITHM, hash: RSA_HASH },
    false,
    ["wrapKey"]
  );
}

/**
 * Import an RSA private key from base64-encoded PKCS8 (non-extractable).
 */
async function importRsaPrivateKey(b64: string): Promise<CryptoKey> {
  const keyData = base64ToUint8Array(b64);
  return crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: RSA_ALGORITHM, hash: RSA_HASH },
    false,
    ["unwrapKey"]
  );
}

// ─── RSA private key wrapping (AES-GCM, not AES-KW) ─────────────────────────

/**
 * Wrap an RSA private key using AES-GCM with the PBKDF2-derived wrapping key.
 * Returns { wrappedKeyB64, ivB64 }.
 */
export async function wrapRsaPrivateKey(
  rsaPrivateKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ wrappedKeyB64: string; ivB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // We need to derive an AES-GCM key from the AES-KW wrapping key.
  // Since the wrapping key is AES-KW (only wrapKey/unwrapKey), we export
  // the RSA private key as pkcs8 and encrypt it manually with AES-GCM.
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", rsaPrivateKey);

  // Import the wrapping key for AES-GCM encryption
  // We need to re-derive for AES-GCM usage since the existing key is AES-KW only
  // Instead, we'll encrypt the raw bytes directly using a fresh AES-GCM key
  // derived from the same password+salt but with AES-GCM usage.
  // 
  // Actually, we receive the wrapping key which has usage=['wrapKey','unwrapKey'].
  // For AES-GCM we need a key with usage=['encrypt','decrypt'].
  // So we export the pkcs8 bytes and encrypt them as raw data.
  //
  // The caller must provide an AES-GCM-capable key. We'll adjust the API.
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    wrappingKey,
    pkcs8
  );

  return {
    wrappedKeyB64: uint8ArrayToBase64(new Uint8Array(encrypted)),
    ivB64: uint8ArrayToBase64(iv),
  };
}

/**
 * Unwrap an RSA private key that was wrapped with AES-GCM.
 * Returns a non-extractable CryptoKey for unwrapKey operations.
 */
export async function unwrapRsaPrivateKey(
  wrappedKeyB64: string,
  ivB64: string,
  unwrappingKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedBytes = base64ToUint8Array(wrappedKeyB64);
  const iv = base64ToUint8Array(ivB64);

  const pkcs8 = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv },
    unwrappingKey,
    wrappedBytes
  );

  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: RSA_ALGORITHM, hash: RSA_HASH },
    false, // non-extractable
    ["unwrapKey"]
  );
}

// ─── Per-letter envelope encryption ──────────────────────────────────────────

/**
 * Generate a fresh one-time AES-GCM key for a single letter.
 */
async function generateContentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true, // extractable for RSA wrapping
    ["encrypt", "decrypt"]
  );
}

/**
 * Wrap a content key with an RSA public key.
 * Returns the wrapped key as base64.
 */
export async function wrapContentKeyWithRsa(
  contentKey: CryptoKey,
  rsaPublicKey: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey(
    "raw",
    contentKey,
    rsaPublicKey,
    { name: RSA_ALGORITHM }
  );
  return uint8ArrayToBase64(new Uint8Array(wrapped));
}

/**
 * Unwrap a content key using an RSA private key.
 * Returns a non-extractable AES-GCM key for decryption.
 */
export async function unwrapContentKeyWithRsa(
  wrappedContentKeyB64: string,
  rsaPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedBytes = base64ToUint8Array(wrappedContentKeyB64);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedBytes,
    rsaPrivateKey,
    { name: RSA_ALGORITHM },
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    false, // non-extractable
    ["encrypt", "decrypt"]
  );
}

// ─── Encrypt / Decrypt with a content key ────────────────────────────────────

async function encryptWithKey(value: string, key: CryptoKey): Promise<string> {
  if (!value) return value;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: AES_ALGORITHM, iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return "enc:" + uint8ArrayToBase64(combined);
}

async function decryptWithKey(encryptedValue: string, key: CryptoKey): Promise<string> {
  if (!encryptedValue) return encryptedValue;
  if (!encryptedValue.startsWith("enc:")) return encryptedValue;
  const combined = base64ToUint8Array(encryptedValue.slice(4));
  const iv = combined.slice(0, IV_LENGTH);
  const encrypted = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: AES_ALGORITHM, iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

// ─── High-level envelope encryption for letters ─────────────────────────────

export interface EnvelopeEncryptedLetter {
  title: string;
  body: string | null;
  signature: string;
  sketchData?: string;
  senderWrappedContentKey: string;
  recipientWrappedContentKey: string;
}

/**
 * Encrypt a letter using envelope encryption:
 * 1. Generate fresh one-time AES key
 * 2. Encrypt all fields with the one-time key
 * 3. Wrap the one-time key for both sender and recipient
 */
export async function envelopeEncryptLetter(
  letter: { title: string; body: string | null; signature: string; sketchData?: string },
  senderRsaPublicKey: CryptoKey,
  recipientRsaPublicKey: CryptoKey
): Promise<EnvelopeEncryptedLetter> {
  const contentKey = await generateContentKey();

  const [encTitle, encBody, encSig, encSketch] = await Promise.all([
    encryptWithKey(letter.title, contentKey),
    letter.body ? encryptWithKey(letter.body, contentKey) : Promise.resolve(null),
    encryptWithKey(letter.signature, contentKey),
    letter.sketchData ? encryptWithKey(letter.sketchData, contentKey) : Promise.resolve(undefined),
  ]);

  const [senderWrapped, recipientWrapped] = await Promise.all([
    wrapContentKeyWithRsa(contentKey, senderRsaPublicKey),
    wrapContentKeyWithRsa(contentKey, recipientRsaPublicKey),
  ]);

  return {
    title: encTitle,
    body: encBody,
    signature: encSig,
    sketchData: encSketch,
    senderWrappedContentKey: senderWrapped,
    recipientWrappedContentKey: recipientWrapped,
  };
}

/**
 * Decrypt a letter that was envelope-encrypted.
 * Uses the appropriate wrapped content key (sender or recipient).
 */
export async function envelopeDecryptLetter<
  T extends { title: string; body: string | null; signature: string; sketchData?: string }
>(
  letter: T,
  wrappedContentKeyB64: string,
  rsaPrivateKey: CryptoKey
): Promise<T> {
  const contentKey = await unwrapContentKeyWithRsa(wrappedContentKeyB64, rsaPrivateKey);

  const [title, body, signature, sketchData] = await Promise.all([
    decryptWithKey(letter.title, contentKey),
    letter.body ? decryptWithKey(letter.body, contentKey) : Promise.resolve(null),
    decryptWithKey(letter.signature, contentKey),
    letter.sketchData ? decryptWithKey(letter.sketchData, contentKey) : Promise.resolve(undefined),
  ]);

  return { ...letter, title, body, signature, sketchData };
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

/**
 * Generate RSA key pair, wrap private key, store both in DB.
 * Called at signup (alongside AES key creation) and as background upgrade.
 *
 * @param userId - user's ID
 * @param gcmWrappingKey - AES-GCM capable key derived from password (same salt as AES-KW key)
 */
export async function generateAndStoreRsaKeys(
  userId: string,
  gcmWrappingKey: CryptoKey
): Promise<void> {
  const keyPair = await generateRsaKeyPair();

  const publicKeyB64 = await exportRsaPublicKey(keyPair.publicKey);
  const { wrappedKeyB64, ivB64 } = await wrapRsaPrivateKey(keyPair.privateKey, gcmWrappingKey);

  const { error } = await supabase
    .from("user_encryption_keys")
    .update({
      rsa_public_key: publicKeyB64,
      wrapped_rsa_private_key: wrappedKeyB64,
      rsa_private_key_iv: ivB64,
      has_rsa_keys: true,
    } as never)
    .eq("user_id", userId);

  if (error) {
    console.error("[RSA] Failed to store RSA keys:", error);
    throw new Error("Failed to store RSA keys");
  }

  // Cache for this session
  // Re-import private key as non-extractable
  const sessionPrivateKey = await unwrapRsaPrivateKey(wrappedKeyB64, ivB64, gcmWrappingKey);
  const sessionPublicKey = await importRsaPublicKey(publicKeyB64);
  cacheRsaKeys(sessionPrivateKey, sessionPublicKey);

  console.log("[RSA] Key pair generated and stored");
}

/**
 * Load and unwrap existing RSA keys from DB into cache.
 * Called at sign-in for users who already have RSA keys.
 */
export async function loadAndCacheRsaKeys(
  userId: string,
  gcmWrappingKey: CryptoKey
): Promise<void> {
  const { data, error } = await supabase
    .from("user_encryption_keys")
    .select("wrapped_rsa_private_key, rsa_private_key_iv, rsa_public_key, has_rsa_keys")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[RSA] Could not fetch RSA key data:", error);
    return;
  }

  if (!data.has_rsa_keys || !data.wrapped_rsa_private_key || !data.rsa_private_key_iv || !data.rsa_public_key) {
    // No RSA keys yet — will be generated in background upgrade
    return;
  }

  const privateKey = await unwrapRsaPrivateKey(
    data.wrapped_rsa_private_key,
    data.rsa_private_key_iv,
    gcmWrappingKey
  );
  const publicKey = await importRsaPublicKey(data.rsa_public_key);
  cacheRsaKeys(privateKey, publicKey);

  console.log("[RSA] Keys loaded and cached");
}

/**
 * Fetch a recipient's RSA public key by email.
 * Returns null if user not found or doesn't have RSA keys yet.
 */
export async function fetchRecipientRsaPublicKey(
  recipientEmail: string
): Promise<CryptoKey | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "get_rsa_public_key_by_email",
    { lookup_email: recipientEmail }
  ) as { data: Array<{ rsa_public_key: string; has_rsa_keys: boolean }> | null; error: any };

  if (error || !data || data.length === 0) return null;
  const row = data[0];
  if (!row.has_rsa_keys || !row.rsa_public_key) return null;

  return importRsaPublicKey(row.rsa_public_key);
}
