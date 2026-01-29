import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, MailCheck, AlertTriangle } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AuthMode = "signin" | "signup" | "forgot" | "reset" | "verify";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  
  const { signIn, signUp, resetPassword, updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const DRAFT_STORAGE_KEY = "letter-draft";
  
  // Check if there's a saved draft - if so, redirect to /write after auth
  const getRedirectPath = () => {
    const hasDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (hasDraft) {
      return "/write";
    }
    return (location.state as { from?: { pathname: string } })?.from?.pathname || "/vault";
  };

  // Check for reset mode from URL (after clicking email link)
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "reset" && session) {
      setMode("reset");
    }
  }, [searchParams, session]);

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
        const { error } = await signUp(email, password);
        if (error) {
          // Handle specific error codes with user-friendly messages
          if (error.message.includes("weak_password") || error.message.includes("pwned") || error.message.includes("easy to guess")) {
            toast.error("This password has been found in data breaches. Please choose a stronger, unique password.");
          } else if (error.message.includes("rate limit") || error.message.includes("over_email_send_rate_limit")) {
            toast.error("We've already sent you a verification email! Please check your inbox (and spam folder) or wait a few minutes before trying again.");
          } else if (error.message.includes("already registered") || error.message.includes("already been registered")) {
            toast.error("This email is already registered. Try signing in instead.");
          } else {
            toast.error(error.message);
          }
        } else {
          // Show verification screen instead of navigating
          setSignupEmail(email);
          setMode("verify");
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          // Check if user needs to verify email
          if (error.message.includes("Email not confirmed")) {
            toast.error("Please verify your email before signing in. Check your spam folder!");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Welcome back!");
          navigate(getRedirectPath(), { replace: true });
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
      case "signup": return "Join signed";
      case "forgot": return "Reset Password";
      case "reset": return "New Password";
      case "verify": return "Check Your Email";
      default: return "Welcome Back";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "signup": return "Create an account to start writing letters";
      case "forgot": return "Enter your email to receive a reset link";
      case "reset": return "Enter your new password";
      case "verify": return `We sent a verification link to ${signupEmail}`;
      default: return "Sign in to access your letters";
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case "signup": return "Create Account";
      case "forgot": return "Send Reset Link";
      case "reset": return "Update Password";
      default: return "Sign In";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden">
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-body">Back</span>
          </Link>
          <Logo size="sm" animate={false} showText />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">
              {getTitle()}
            </h1>
            <p className="text-muted-foreground font-body">
              {getSubtitle()}
            </p>
          </div>

          {/* Verification Success Screen */}
          {mode === "verify" ? (
            <div className="space-y-6">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailCheck className="w-10 h-10 text-primary" />
                </div>
              </div>

              {/* Important Spam Warning */}
              <div className="bg-accent/50 border border-accent rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">
                      Check your spam folder!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Our verification email may land in spam. To ensure you receive your future letters:
                    </p>
                    <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                      <li>Find the email from <strong>signed</strong></li>
                      <li>Mark it as "Not Spam"</li>
                      <li>Add <strong>team@notify.signedletter.com</strong> to your contacts</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Back to Sign In */}
              <Button
                type="button"
                onClick={() => setMode("signin")}
                className="w-full h-12 rounded-xl font-body text-base"
              >
                I've verified — Sign In
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the email?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setEmail(signupEmail);
                    setMode("signup");
                  }}
                  className="text-primary hover:underline"
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
            <>
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

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl font-body text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
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
                        <button
                          onClick={() => setMode("signup")}
                          className="ml-2 text-primary hover:underline font-medium"
                        >
                          Sign up
                        </button>
                      </>
                    )}
                    {mode === "signup" && (
                      <>
                        Already have an account?
                        <button
                          onClick={() => setMode("signin")}
                          className="ml-2 text-primary hover:underline font-medium"
                        >
                          Sign in
                        </button>
                      </>
                    )}
                    {mode === "forgot" && (
                      <>
                        Remember your password?
                        <button
                          onClick={() => setMode("signin")}
                          className="ml-2 text-primary hover:underline font-medium"
                        >
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default Auth;
