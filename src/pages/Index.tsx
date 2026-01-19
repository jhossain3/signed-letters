import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { PenTool, Type, Instagram } from "lucide-react";
import Logo from "@/components/Logo";
import WaitlistForm from "@/components/WaitlistForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const Index = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    
    // Google Form submission
    const formData = new URLSearchParams();
    formData.append("entry.1045781291", email);
    
    try {
      await fetch(
        "https://docs.google.com/forms/d/e/1FAIpQLSf02XrrVaQG7fT43FrArCoYWFTPcEPBHBhIffOD_6qBDIvcTQ/formResponse",
        {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        }
      );
      setIsSubscribed(true);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden">
      {/* Subtle paper texture overlay */}
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      {/* Hero Section */}
      <section className="relative z-10 min-h-[90vh] flex flex-col">
        <div className="container mx-auto px-6 md:px-12 flex-1 flex items-center">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full py-16">
            {/* Left side - Editorial headline */}
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* Logo */}
              <div className="mb-8">
                <Logo size="lg" animate={false} showText />
              </div>

              {/* Main headline */}
              <h1 className="font-editorial text-5xl md:text-6xl lg:text-7xl text-foreground leading-[1.1] tracking-tight">
                <span className="italic">sign</span> it off
              </h1>

              {/* Accent line */}
              <div className="accent-line" />

              {/* Description */}
              <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-lg font-body">
                Your digital space to write and send meaningful letters to your future self and the people you love. 
                <span className="block mt-2 text-foreground/80">
                  Write something special today — we'll keep it safe.
                </span>
              </p>

              {/* Waitlist Form - inline in hero */}
              {!isSubscribed ? (
                <motion.form 
                  onSubmit={handleWaitlistSubmit}
                  className="flex flex-col sm:flex-row gap-3 max-w-md"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1 h-12 rounded-full px-5 bg-card/80 border-border focus:border-primary transition-colors"
                  />
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="h-12 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-editorial"
                  >
                    {isSubmitting ? "Joining..." : "Join Waitlist"}
                  </Button>
                </motion.form>
              ) : (
                <motion.div 
                  className="flex items-center gap-3 text-primary font-medium"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <span className="text-2xl">✓</span>
                  <span>You're on the list! We'll be in touch.</span>
                </motion.div>
              )}

              {/* Callouts - subtle indicators for typed/sketched */}
              <motion.div 
                className="flex items-center gap-8 pt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Type className="w-4 h-4" />
                  <span>Type your thoughts</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <PenTool className="w-4 h-4" />
                  <span>Or sketch by hand</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right side - Editorial image or decorative element */}
            <motion.div
              className="relative hidden lg:flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              {/* Decorative envelope illustration */}
              <div className="relative w-full max-w-md aspect-square">
                {/* Background circles */}
                <div className="absolute inset-0">
                  <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full bg-accent/40 blur-2xl" />
                  <div className="absolute bottom-1/4 left-1/4 w-32 h-32 rounded-full bg-dusty-rose/20 blur-xl" />
                </div>
                
                {/* Main envelope */}
                <motion.div 
                  className="relative z-10 w-full h-full flex items-center justify-center"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg viewBox="0 0 200 150" className="w-80 h-60 drop-shadow-xl">
                    {/* Envelope back */}
                    <rect
                      x="20"
                      y="40"
                      width="160"
                      height="100"
                      rx="8"
                      fill="hsl(var(--envelope-cream))"
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                    />
                    
                    {/* Envelope inner shadow */}
                    <rect
                      x="30"
                      y="50"
                      width="140"
                      height="80"
                      rx="4"
                      fill="hsl(var(--background))"
                      opacity="0.5"
                    />
                    
                    {/* Envelope flap */}
                    <path
                      d="M 20 40 L 100 85 L 180 40"
                      fill="hsl(var(--cream))"
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                    />
                    
                    {/* Wax seal */}
                    <g transform="translate(100, 80)">
                      <circle 
                        cx="0" 
                        cy="0" 
                        r="18" 
                        className="wax-seal"
                        fill="hsl(var(--seal-maroon))"
                      />
                      {/* Logo mark on seal - line and dot */}
                      <line
                        x1="-8"
                        y1="0"
                        x2="5"
                        y2="0"
                        stroke="hsl(var(--primary-foreground))"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="9"
                        cy="0"
                        r="3"
                        fill="hsl(var(--primary-foreground))"
                      />
                    </g>
                  </svg>
                </motion.div>

                {/* Decorative geometric accents */}
                <div className="absolute -top-4 -right-4 w-8 h-8 border-2 border-primary/30 rounded-full" />
                <div className="absolute -bottom-8 left-8 w-4 h-4 bg-primary/20 rounded-full" />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Sealed letter notice */}
        <motion.div 
          className="container mx-auto px-6 md:px-12 pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-center text-muted-foreground text-sm italic">
            Once sealed, letters cannot be viewed, edited, or rewritten until their delivery date.
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 md:px-12 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo and tagline */}
            <div className="flex items-center gap-4">
              <Logo size="sm" animate={false} showText />
              <span className="text-muted-foreground text-sm">Letters through time</span>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-6">
              <a
                href="https://www.instagram.com/signed.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Follow us on Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://www.tiktok.com/@letters_for_later"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Follow us on TikTok"
              >
                <TikTokIcon />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
