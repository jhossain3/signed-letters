import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deriveGcmWrappingKey } from "@/lib/encryption";
import {
  generateRecoveryCode,
  wrapKeyWithRecoveryCode,
  storeRecoveryKey,
  hasRecoveryKey,
} from "@/lib/recoveryKey";
import RecoveryCodeModal from "@/components/RecoveryCodeModal";

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [encryptionVersion, setEncryptionVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    // Check recovery key status and encryption version
    (async () => {
      const hasKey = await hasRecoveryKey(user.id);
      setHasRecovery(hasKey);

      const { data } = await supabase
        .from('user_encryption_keys')
        .select('encryption_version')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setEncryptionVersion((data as never as { encryption_version: number }).encryption_version);
      }
    })();
  }, [user]);

  const handleGenerateRecoveryKey = async () => {
    if (!user || !password.trim()) {
      toast.error("Please enter your current password");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch salt + wrapped_key to verify password
      const { data: keyRow, error } = await supabase
        .from('user_encryption_keys')
        .select('salt, wrapped_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !keyRow) {
        toast.error("Could not fetch encryption data");
        setIsLoading(false);
        return;
      }

      const row = keyRow as never as { salt: string; wrapped_key: string };
      if (!row.salt || !row.wrapped_key) {
        toast.error("Encryption key not found. Are you a V2 user?");
        setIsLoading(false);
        return;
      }

      // 2. Derive wrapping key from password to verify it's correct
      const saltBytes = Uint8Array.from(atob(row.salt), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

      // Derive AES-KW key to unwrap the data key
      const encoder = new TextEncoder();
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      const wrappingKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 310_000,
          hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-KW', length: 256 },
        false,
        ['wrapKey', 'unwrapKey'],
      );

      // 3. Unwrap the AES data key (extractable so we can re-wrap)
      const wrappedKeyBytes = Uint8Array.from(atob(row.wrapped_key), c => c.charCodeAt(0));
      let aesKey: CryptoKey;
      try {
        aesKey = await crypto.subtle.unwrapKey(
          'raw',
          wrappedKeyBytes,
          wrappingKey,
          'AES-KW',
          { name: 'AES-GCM', length: 256 },
          true, // extractable so we can wrap with recovery code
          ['encrypt', 'decrypt'],
        );
      } catch {
        toast.error("Incorrect password. Please try again.");
        setIsLoading(false);
        return;
      }

      // 4. Generate recovery code and wrap
      const code = generateRecoveryCode();
      const { wrappedKeyB64, saltB64 } = await wrapKeyWithRecoveryCode(aesKey, code);

      // 5. Store in DB
      await storeRecoveryKey(user.id, wrappedKeyB64, saltB64);

      // 6. Show modal
      setRecoveryCode(code);
      setShowRecoveryModal(true);
      setHasRecovery(true);
      setPassword("");
      toast.success("Recovery key generated successfully!");
    } catch (err) {
      console.error('[Settings] Recovery key generation failed:', err);
      toast.error("Failed to generate recovery key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isV2 = encryptionVersion === 2;

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden">
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      <header className="container mx-auto px-4 py-6 relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-body">Back</span>
        </button>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground font-body mb-10">Manage your account and security</p>

          {/* Recovery Key Section */}
          <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="font-editorial text-xl text-foreground">Recovery Key</h2>
            </div>

            {!isV2 && encryptionVersion !== null && (
              <p className="text-sm text-muted-foreground font-body">
                Recovery keys are only available for V2 encrypted accounts. Your account will be upgraded on your next sign-in.
              </p>
            )}

            {isV2 && (
              <>
                {/* Status */}
                <div className="flex items-center gap-2">
                  {hasRecovery ? (
                    <>
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-body text-foreground">Recovery key is set</span>
                    </>
                  ) : hasRecovery === false ? (
                    <>
                      <ShieldOff className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-body text-foreground">No recovery key configured</span>
                    </>
                  ) : (
                    <span className="text-sm font-body text-muted-foreground">Loading…</span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground font-body">
                  {hasRecovery
                    ? "You can regenerate your recovery key at any time. This will invalidate the old one."
                    : "Set up a recovery key so you can regain access to your encrypted letters if you forget your password."}
                </p>

                {/* Password input */}
                <div className="space-y-3">
                  <Input
                    type="password"
                    placeholder="Enter your current password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-border/50 bg-card/50"
                  />
                  <Button
                    className="w-full gap-2"
                    onClick={handleGenerateRecoveryKey}
                    disabled={isLoading || !password.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {hasRecovery ? "Regenerate Recovery Key" : "Set Up Recovery Key"}
                  </Button>
                </div>
              </>
            )}

            {encryptionVersion === null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-body">Loading…</span>
              </div>
            )}
          </section>
        </motion.div>
      </main>

      <RecoveryCodeModal
        open={showRecoveryModal}
        recoveryCode={recoveryCode}
        onClose={() => {
          setShowRecoveryModal(false);
          setRecoveryCode("");
        }}
      />
    </div>
  );
};

export default Settings;
