import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  clearKeyCache,
  initializeUserEncryptionKey,
  createAndStoreWrappedKey,
  unwrapV2KeyOptimistic,
  cacheRawKey,
  migrateV1ToV2,
  deriveGcmWrappingKey,
} from "@/lib/encryption";
import {
  generateAndStoreRsaKeys,
  loadAndCacheRsaKeys,
  clearRsaKeyCache,
} from "@/lib/rsaEncryption";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // For v1 users that didn't go through the new signIn flow
        // (e.g. session restored from storage), initialize their key.
        // V2 users will already have their key in cache from signIn.
        if (event === 'SIGNED_IN' && session?.user) {
          initializeUserEncryptionKey(session.user.id).catch((err) => {
            // V2 cold-cache is handled by useEncryptionReady — ignore here
            const message = err instanceof Error ? err.message : String(err);
            if (message !== 'V2_KEY_REQUIRES_REAUTH') {
              console.error('[Auth] Encryption key init failed:', err);
            }
          });
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, retryCount = 0): Promise<{ error: Error | null }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    // Check for rate limit errors and retry once after delay
    if (error && retryCount < 1) {
      const isRateLimited =
        error.message.includes("Too many signup attempts") ||
        error.message.includes("rate limit") ||
        error.message.includes("too many requests");

      if (isRateLimited) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return signUp(email, password, retryCount + 1);
      }
    }

    if (error) return { error };

    // Signup succeeded — now create and store the v2 wrapped key in the browser
    if (data.user && data.session) {
      try {
        await createAndStoreWrappedKey(data.user.id, password);

        // Also generate RSA key pair for envelope encryption
        // Fetch the salt we just stored to derive the GCM wrapping key
        const { data: keyRow } = await supabase
          .from('user_encryption_keys')
          .select('salt')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (keyRow?.salt) {
          const saltBytes = Uint8Array.from(atob(keyRow.salt), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
          const gcmKey = await deriveGcmWrappingKey(password, saltBytes);
          await generateAndStoreRsaKeys(data.user.id, gcmKey);
        }
      } catch (keyError) {
        console.error('[Auth] Failed to store encryption key — rolling back account:', keyError);
        // Roll back the auth account using the user's own JWT
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/delete-own-account`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${data.session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } catch (rollbackError) {
          console.error('[Auth] Account rollback also failed:', rollbackError);
        }
        await supabase.auth.signOut();
        return {
          error: new Error('Account setup failed. Please try signing up again.'),
        };
      }
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    // Step 1: Pre-fetch KDF metadata before auth so we can unwrap the key
    // while the password is still available in this closure.
    let preUnwrappedKey: CryptoKey | null = null;
    let encryptionVersion = 1;
    let saltB64: string | null = null;
    let hasRsaKeys = false;
    let wrappedRsaPrivateKey: string | null = null;
    let rsaPrivateKeyIv: string | null = null;
    let rsaPublicKeyB64: string | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: metaRows } = await (supabase.rpc as any)(
        'get_encryption_metadata_by_email',
        { lookup_email: email }
      ) as { data: Array<{ salt: string; wrapped_key: string; encryption_version: number }> | null };

      if (metaRows && metaRows.length > 0) {
        const meta = metaRows[0];
        encryptionVersion = meta.encryption_version ?? 1;
        saltB64 = meta.salt;

        if (encryptionVersion === 2 && meta.wrapped_key && meta.salt) {
          // Optimistically unwrap the AES key — do NOT cache yet (no userId)
          preUnwrappedKey = await unwrapV2KeyOptimistic(meta.wrapped_key, meta.salt, password);
        }
      }
    } catch (metaError) {
      // Non-fatal — fall back to v1 flow
      console.warn('[Auth] Could not fetch encryption metadata:', metaError);
    }

    // Step 2: Authenticate
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    const userId = data.user.id;

    // Step 3: Put the pre-unwrapped key into cache under the real userId
    if (encryptionVersion === 2 && preUnwrappedKey) {
      cacheRawKey(userId, preUnwrappedKey);
      console.log('[Auth] V2 key cached after sign-in');

      // Step 4: Load or generate RSA keys (background, non-blocking)
      if (saltB64) {
        const saltBytes = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
        const gcmKey = await deriveGcmWrappingKey(password, saltBytes);

        // Fetch RSA key status
        const { data: keyRow } = await supabase
          .from('user_encryption_keys')
          .select('has_rsa_keys, wrapped_rsa_private_key, rsa_private_key_iv, rsa_public_key')
          .eq('user_id', userId)
          .maybeSingle();

        if (keyRow?.has_rsa_keys) {
          // Load existing RSA keys into cache — await so they're ready for re-encryption hook
          try {
            await loadAndCacheRsaKeys(userId, gcmKey);
          } catch (err) {
            console.warn('[Auth] RSA key load failed:', err);
          }
        } else {
          // Silent background RSA upgrade for existing V2 users
          console.log('[Auth] Generating RSA keys for existing V2 user (background)');
          generateAndStoreRsaKeys(userId, gcmKey).catch(err => {
            console.warn('[Auth] RSA key generation failed (non-fatal):', err);
          });
        }
      }
    } else {
      // V1 user: migrate to V2, then generate RSA keys
      (async () => {
        try {
          await migrateV1ToV2(userId, password);
          // After migration, fetch the new salt and generate RSA keys
          const { data: keyRow } = await supabase
            .from('user_encryption_keys')
            .select('salt')
            .eq('user_id', userId)
            .maybeSingle();

          if (keyRow?.salt) {
            const saltBytes = Uint8Array.from(atob(keyRow.salt), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
            const gcmKey = await deriveGcmWrappingKey(password, saltBytes);
            await generateAndStoreRsaKeys(userId, gcmKey);
            await loadAndCacheRsaKeys(userId, gcmKey);
            console.log('[Auth] RSA keys generated after V1→V2 migration');
          }
        } catch (err) {
          console.warn('[Auth] V1→V2 migration or RSA generation failed:', err);
        }
      })();
    }

    return { error: null };
  };

  const signOut = async () => {
    clearKeyCache(); // Clear AES encryption keys on logout
    clearRsaKeyCache(); // Clear RSA keys on logout
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
