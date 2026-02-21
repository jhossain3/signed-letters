import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deriveGcmWrappingKey, cacheRawKey } from "@/lib/encryption";
import {
  fetchRecoveryMetadata,
  unwrapKeyWithRecoveryCode,
  generateRecoveryCode,
  wrapKeyWithRecoveryCode,
  storeRecoveryKey,
  normalizeRecoveryCode,
} from "@/lib/recoveryKey";
import {
  loadAndCacheRsaKeys,
  generateAndStoreRsaKeys,
} from "@/lib/rsaEncryption";
import RecoveryCodeModal from "@/components/RecoveryCodeModal";

type AuthMode = "signin" | "signup" | "forgot" | "reset";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get("mode") as AuthMode) || "signin";
  const initialEmail = searchParams.get("email") || "";
  const [mode, setMode] = useState<AuthMode>(initialMode === "signup" || initialMode === "reset" || initialMode === "forgot" ? initialMode : "signin");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // Recovery key state
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const { signIn, signUp, resetPassword, updatePassword, session, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/vault";

  // Redirect already-authenticated users to /write (unless resetting password)
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (session && !authLoading && urlMode !== "reset") {
      navigate("/write", { replace: true });
      return;
    }
    if (urlMode === "reset" && session) {
      setMode("reset");
    }
  }, [searchParams, session, authLoading, navigate]);

  // Handle countdown timer
  useEffect(() => {
    if (rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitCountdown]);

  const handleRecoveryReset = async (newPassword: string) => {
    // 1. Update the password via Supabase (user is authenticated via reset link)
    setIsLoading(true);
    try {
      const { error: pwError } = await updatePassword(newPassword);
      if (pwError) {
        toast.error(pwError.message);
        setIsLoading(false);
        return;
      }

      // 2. Fetch recovery metadata
      const user = session?.user;
      if (!user?.email) {
        toast.error("Session error. Please try again.");
        setIsLoading(false);
        return;
      }

      const meta = await fetchRecoveryMetadata(user.email);
      if (!meta?.recoveryWrappedKey || !meta?.recoveryKeySalt) {
        toast.error("No recovery key found for this account.");
        setIsLoading(false);
        return;
      }

      // 3. Unwrap the AES data key with the recovery code
      let aesKey: CryptoKey;
      try {
        aesKey = await unwrapKeyWithRecoveryCode(
          meta.recoveryWrappedKey,
          meta.recoveryKeySalt,
          recoveryCodeInput,
        );
      } catch {
        toast.error("Invalid recovery code. Your password was updated but encryption keys were not recovered.");
        setIsLoading(false);
        return;
      }

      // 4. Re-wrap the AES key with the new password (AES-KW, same as signup)
      const newSaltBytes = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
      const encoder = new TextEncoder();
      const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(newPassword), 'PBKDF2', false, ['deriveKey']);
      const newWrappingKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: newSaltBytes, iterations: 310_000, hash: 'SHA-256' },
        passwordKey,
        { name: 'AES-KW', length: 256 },
        false,
        ['wrapKey', 'unwrapKey'],
      );

      const wrappedKeyBuffer = await crypto.subtle.wrapKey('raw', aesKey, newWrappingKey, 'AES-KW');
      const wrappedKeyB64 = btoa(String.fromCharCode(...new Uint8Array(wrappedKeyBuffer)));
      const newSaltB64 = btoa(String.fromCharCode(...newSaltBytes));

      // 5. Update wrapped_key + salt in DB
      const { error: updateError } = await supabase
        .from('user_encryption_keys')
        .update({
          wrapped_key: wrappedKeyB64,
          salt: newSaltB64,
          encryption_version: 2,
        } as never)
        .eq('user_id', user.id);

      if (updateError) {
        toast.error("Failed to update encryption keys.");
        setIsLoading(false);
        return;
      }

      // 6. Generate new recovery code
      const newCode = generateRecoveryCode();
      const { wrappedKeyB64: newRecWrapped, saltB64: newRecSalt } = await wrapKeyWithRecoveryCode(aesKey, newCode);
      await storeRecoveryKey(user.id, newRecWrapped, newRecSalt);

      // 7. Re-wrap RSA private key with new password-derived GCM key
      try {
        const gcmKey = await deriveGcmWrappingKey(newPassword, newSaltBytes);
        // Check if user has RSA keys
        const { data: keyRow } = await supabase
          .from('user_encryption_keys')
          .select('has_rsa_keys')
          .eq('user_id', user.id)
          .maybeSingle();

        if ((keyRow as never as { has_rsa_keys: boolean })?.has_rsa_keys) {
          // Can't re-wrap without old GCM key — generate fresh RSA keys
          await generateAndStoreRsaKeys(user.id, gcmKey);
          await loadAndCacheRsaKeys(user.id, gcmKey);
          console.log('[Auth] RSA keys regenerated after recovery');
        } else {
          await generateAndStoreRsaKeys(user.id, gcmKey);
          await loadAndCacheRsaKeys(user.id, gcmKey);
        }
      } catch (rsaErr) {
        console.warn('[Auth] RSA key regen after recovery failed (non-fatal):', rsaErr);
      }

      // 8. Cache the AES key (non-extractable) for this session
      const sessionKey = await crypto.subtle.importKey(
        'raw',
        await crypto.subtle.exportKey('raw', aesKey),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      cacheRawKey(user.id, sessionKey);

      // 9. Show new recovery code
      setRecoveryCode(newCode);
      setShowRecoveryModal(true);
      toast.success("Password updated and encryption keys recovered!");
    } catch (err) {
      console.error('[Auth] Recovery reset failed:', err);
      toast.error("Recovery failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "forgot") {
      if (!email.trim()) {
        toast.error("Please enter your email");
        return;
      }
      setIsLoading(true);
      const { error } = await resetPassword(email);
      setIsLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Check your email for a reset link!");
        setMode("signin");
      }
      return;
    }

    if (mode === "reset") {
      if (!password.trim() || password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      // If using recovery key, run the full recovery flow
      if (useRecoveryKey) {
        if (!recoveryCodeInput.trim()) {
          toast.error("Please enter your recovery code");
          return;
        }
        await handleRecoveryReset(password);
        return;
      }

      // Standard reset (no key recovery)
      setIsLoading(true);
      const { error } = await updatePassword(password);
      setIsLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully!");
        navigate("/vault", { replace: true });
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "signup") {
        const { error, recoveryCode: code } = await signUp(email, password);
        if (error) {
          const isRateLimited =
            error.message.includes("Too many signup attempts") ||
            error.message.includes("rate limit") ||
            error.message.includes("over_email_send_rate_limit") ||
            error.message.includes("too many requests");

          if (isRateLimited) {
            setRateLimitCountdown(30);
            toast.error("High traffic detected. We're retrying automatically—please wait a moment.", {
              duration: 6000,
            });
          } else if (error.message.includes("User already registered")) {
            toast.error("An account with this email already exists. Try signing in instead.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Account created successfully!");
          // Show recovery code modal if we generated one
          if (code) {
            setRecoveryCode(code);
            setShowRecoveryModal(true);
          } else {
            navigate(from, { replace: true });
          }
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back!");
          navigate(from, { replace: true });
        }
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "signup":
        return "Join signed";
      case "forgot":
        return "Reset Password";
      case "reset":
        return "New Password";
      default:
        return "Welcome Back";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "signup":
        return "Create an account to start writing";
      case "forgot":
        return "Enter your email to receive a reset link";
      case "reset":
        return useRecoveryKey
          ? "Enter your recovery code and new password to restore access to your letters"
          : "Enter your new password";
      default:
        return "Sign in to access your entries";
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case "signup":
        return "Create Account";
      case "forgot":
        return "Send Reset Link";
      case "reset":
        return useRecoveryKey ? "Recover & Update Password" : "Update Password";
      default:
        return "Sign In";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden">
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-body">Back</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-md relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">{getTitle()}</h1>
            <p className="text-muted-foreground font-body">{getSubtitle()}</p>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Email - shown for signin, signup, forgot */}
              {mode !== "reset" && (
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-border/50 bg-card/50"
                  />
                </div>
              )}

              {/* Recovery key toggle — shown on reset mode */}
              {mode === "reset" && (
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border/50 bg-card/50">
                  <input
                    type="checkbox"
                    checked={useRecoveryKey}
                    onChange={(e) => setUseRecoveryKey(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <span className="text-sm font-body text-foreground">I have a recovery key</span>
                  </div>
                </label>
              )}

              {/* Recovery code input — shown when toggle is on */}
              {mode === "reset" && useRecoveryKey && (
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    value={recoveryCodeInput}
                    onChange={(e) => setRecoveryCodeInput(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-border/50 bg-card/50 font-mono tracking-wider uppercase"
                  />
                </div>
              )}

              {/* Password - shown for signin, signup, reset */}
              {mode !== "forgot" && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "reset" ? "New password" : "Password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 rounded-xl border-border/50 bg-card/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              )}

              {/* Confirm Password - shown for reset */}
              {mode === "reset" && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 rounded-xl border-border/50 bg-card/50"
                  />
                </div>
              )}
            </div>

            {/* Forgot Password Link */}
            {mode === "signin" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Recovery key hint on reset mode */}
            {mode === "reset" && !useRecoveryKey && (
              <p className="text-xs text-muted-foreground font-body text-center">
                ⚠️ Without a recovery key, resetting your password will make your existing encrypted letters unreadable.
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-body text-base"
              disabled={isLoading || rateLimitCountdown > 0}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : rateLimitCountdown > 0 ? (
                `Please wait ${rateLimitCountdown}s...`
              ) : (
                getButtonText()
              )}
            </Button>
          </form>

          {/* Toggle Mode */}
          {mode !== "reset" && (
            <div className="text-center mt-8">
              <p className="text-muted-foreground font-body">
                {mode === "signin" && (
                  <>
                    Don't have an account?
                    <button onClick={() => setMode("signup")} className="ml-2 text-primary hover:underline font-medium">
                      Sign up
                    </button>
                  </>
                )}
                {mode === "signup" && (
                  <>
                    Already have an account?
                    <button onClick={() => setMode("signin")} className="ml-2 text-primary hover:underline font-medium">
                      Sign in
                    </button>
                  </>
                )}
                {mode === "forgot" && (
                  <>
                    Remember your password?
                    <button onClick={() => setMode("signin")} className="ml-2 text-primary hover:underline font-medium">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          )}
        </motion.div>
      </main>

      {/* Recovery Code Modal */}
      <RecoveryCodeModal
        open={showRecoveryModal}
        recoveryCode={recoveryCode}
        onClose={() => {
          setShowRecoveryModal(false);
          setRecoveryCode("");
          // Navigate after modal closes
          if (mode === "signup") {
            navigate(from, { replace: true });
          } else if (mode === "reset") {
            navigate("/vault", { replace: true });
          }
        }}
      />
    </div>
  );
};

export default Auth;
