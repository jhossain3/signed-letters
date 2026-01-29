import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AuthMode = "signin" | "signup" | "forgot" | "reset";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn, signUp, resetPassword, updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/vault";

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
          // Handle rate limit errors specifically
          if (error.message.includes("rate limit") || error.message.includes("over_email_send_rate_limit") || error.message.includes("too many requests")) {
            toast.error("Our servers are experiencing high traffic. Please wait 30 seconds and try again.", {
              duration: 6000,
            });
          } else if (error.message.includes("User already registered")) {
            toast.error("An account with this email already exists. Try signing in instead.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Account created successfully!");
          navigate(from, { replace: true });
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
      case "signup": return "Join signed";
      case "forgot": return "Reset Password";
      case "reset": return "New Password";
      default: return "Welcome Back";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "signup": return "Create an account to start writing letters";
      case "forgot": return "Enter your email to receive a reset link";
      case "reset": return "Enter your new password";
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
        </motion.div>
      </main>
    </div>
  );
};

export default Auth;
