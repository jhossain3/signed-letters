// Migration utility to re-encrypt letters from email-based keys to random keys
// This handles letters encrypted with the old PBKDF2-from-email system

import { supabase } from "@/integrations/supabase/client";

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Derive key using the OLD email-based method (for decryption only)
 */
async function deriveKeyFromEmail(userEmail: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userEmail.toLowerCase().trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = encoder.encode('signed-letters-v2-email-derived-key');

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

/**
 * Decrypt a value using the old email-based key
 */
async function decryptWithEmailKey(encryptedValue: string, userEmail: string): Promise<string> {
  if (!encryptedValue || !encryptedValue.startsWith('enc:')) {
    return encryptedValue;
  }
  
  try {
    const key = await deriveKeyFromEmail(userEmail);
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
    console.error('Legacy decryption failed:', error);
    return encryptedValue; // Return as-is if can't decrypt
  }
}

/**
 * Check if a letter needs migration (encrypted with old email key)
 */
export async function needsMigration(userId: string): Promise<boolean> {
  // Check if user has a stored random key
  const { data } = await supabase
    .from('user_encryption_keys')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  
  // If no key exists, we need to check if there are encrypted letters
  if (!data) {
    const { data: letters } = await supabase
      .from('letters')
      .select('title')
      .eq('user_id', userId)
      .limit(1);
    
    // If letters exist and start with 'enc:', they need migration
    return letters?.some(l => l.title?.startsWith('enc:')) ?? false;
  }
  
  return false;
}

/**
 * Migrate all letters from email-based encryption to random key encryption
 */
export async function migrateLettersToRandomKey(
  userId: string, 
  userEmail: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; migratedCount: number; error?: string }> {
  try {
    // Import the new encryption functions
    const { encryptValue, clearKeyCache } = await import('./encryption');
    
    // Clear any cached keys to ensure fresh state
    clearKeyCache();
    
    // Fetch all user's letters
    const { data: letters, error: fetchError } = await supabase
      .from('letters')
      .select('*')
      .eq('user_id', userId);
    
    if (fetchError) throw fetchError;
    if (!letters || letters.length === 0) {
      return { success: true, migratedCount: 0 };
    }
    
    let migratedCount = 0;
    
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      onProgress?.(i + 1, letters.length);
      
      // Check if any field is encrypted with old key
      const needsUpdate = 
        letter.title?.startsWith('enc:') ||
        letter.body?.startsWith('enc:') ||
        letter.signature?.startsWith('enc:') ||
        letter.sketch_data?.startsWith('enc:');
      
      if (!needsUpdate) continue;
      
      // Decrypt with old email-based key
      const decryptedTitle = await decryptWithEmailKey(letter.title, userEmail);
      const decryptedBody = letter.body ? await decryptWithEmailKey(letter.body, userEmail) : null;
      const decryptedSignature = await decryptWithEmailKey(letter.signature, userEmail);
      const decryptedSketchData = letter.sketch_data ? await decryptWithEmailKey(letter.sketch_data, userEmail) : null;
      
      // Re-encrypt with new random key (uses userId)
      const newTitle = await encryptValue(decryptedTitle, userId);
      const newBody = decryptedBody ? await encryptValue(decryptedBody, userId) : null;
      const newSignature = await encryptValue(decryptedSignature, userId);
      const newSketchData = decryptedSketchData ? await encryptValue(decryptedSketchData, userId) : null;
      
      // Update in database
      const { error: updateError } = await supabase
        .from('letters')
        .update({
          title: newTitle,
          body: newBody,
          signature: newSignature,
          sketch_data: newSketchData,
        })
        .eq('id', letter.id);
      
      if (updateError) {
        console.error('Failed to update letter:', letter.id, updateError);
        continue;
      }
      
      migratedCount++;
    }
    
    return { success: true, migratedCount };
  } catch (error) {
    console.error('Migration failed:', error);
    return { 
      success: false, 
      migratedCount: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
