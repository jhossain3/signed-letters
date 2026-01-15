import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Configuration constants - replace with your actual Google Form values
const FORM_ACTION_URL = "YOUR_GOOGLE_FORM_ACTION_URL";
const EMAIL_ENTRY_ID = "YOUR_EMAIL_ENTRY_ID";
const NAME_ENTRY_ID = "YOUR_NAME_ENTRY_ID";

interface WaitlistFormProps {
  onSuccess?: () => void;
}

const WaitlistForm = ({ onSuccess }: WaitlistFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new URLSearchParams();
    formData.append(EMAIL_ENTRY_ID, email);
    if (name) {
      formData.append(NAME_ENTRY_ID, name);
    }

    try {
      await fetch(FORM_ACTION_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      setIsSuccess(true);
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-8 text-center"
      >
        <motion.span
          className="text-5xl block mb-4"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
        >
          🎉
        </motion.span>
        <h3 className="font-serif text-2xl font-bold text-foreground mb-2">
          You're on the list!
        </h3>
        <p className="text-muted-foreground">
          We'll send you an email when we launch.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card dark:bg-card rounded-2xl shadow-lg p-6 sm:p-8"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">
            Name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full transition-all duration-200 focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full transition-all duration-200 focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-colors duration-200"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : (
            "Join Waitlist"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4">
        We respect your privacy. No spam, ever. 🔒
      </p>
    </motion.div>
  );
};

export default WaitlistForm;
