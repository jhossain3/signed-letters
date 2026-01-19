import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Configuration constants - replace with your actual Google Form values
const FORM_ACTION_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf02XrrVaQG7fT43FrArCoYWFTPcEPBHBhIffOD_6qBDIvcTQ/formResponse";
const EMAIL_ENTRY_ID = "entry.1045781291";
const NAME_ENTRY_ID = "entry.2005620554";

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
        body: formData,
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
        <h3 className="font-serif text-2xl font-bold text-foreground mb-2">You're on the list!</h3>
        <p className="text-muted-foreground mb-4">We'll send you an email when we launch.</p>
        
        <p className="text-sm text-muted-foreground mb-3">Follow us on our socials to stay up to date</p>
        <div className="flex justify-center gap-4">
          <a
            href="https://www.tiktok.com/@letters_for_later"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Follow us on TikTok"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
            </svg>
          </a>
          <a
            href="https://www.instagram.com/signed.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Follow us on Instagram"
          >
            <Instagram className="h-6 w-6" />
          </a>
        </div>
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

      <p className="text-center text-sm text-muted-foreground mt-4">We respect your privacy. No spam, ever. 🔒</p>
    </motion.div>
  );
};

export default WaitlistForm;
