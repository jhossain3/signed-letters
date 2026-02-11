import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Instagram, PenLine, Clock, Mail, Calendar, MessageCircle } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-editorial.jpg";

const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const Index = () => {
  const steps = [
    {
      icon: PenLine,
      title: "Write",
      description: "Put your thoughts into words — typed or handwritten.",
    },
    {
      icon: Clock,
      title: "Seal",
      description: "Choose when it arrives. Tomorrow, next year, or beyond.",
    },
    {
      icon: Mail,
      title: "Receive",
      description: "When the time comes, your words find their way back.",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle paper texture overlay */}
      <div className="absolute inset-0 paper-texture pointer-events-none opacity-50" />

      {/* Hero Section */}
      <section className="relative z-10 min-h-[85vh] flex flex-col">
        <div className="container mx-auto px-6 md:px-12 flex-1 flex items-center">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full py-16">
            {/* Left side - Editorial content */}
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              {/* Logo */}
              <div className="mb-6">
                <Logo size="lg" animate={false} showText />
              </div>

              {/* Main headline */}
              <h1 className="font-editorial text-5xl md:text-6xl lg:text-7xl text-foreground leading-[1.05] tracking-tight">
                <em className="italic">sign</em> it off
              </h1>

              {/* Accent line */}
              <div className="w-16 h-px bg-foreground/20" />

              {/* Description */}
              <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-md font-body">
                A quiet space to write across time. Reflect, remember, and send words to your future self or someone you
                hold dear.
              </p>

              {/* Event Promotion - Primary CTA */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="max-w-md space-y-4 rounded-xl border border-border/60 bg-card/40 p-5"
              >
                <div className="space-y-2">
                  <h2 className="font-editorial text-2xl text-foreground">Join Us for Our Launch Event</h2>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm font-body">
                    <Calendar className="h-4 w-4" />
                    <span>February 14, 2026</span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed font-body">
                    An afternoon of reflection with award-winning author Dr Jinan Yousef and a guided workshop — set
                    meaningful goals and write a note to your future self.
                  </p>
                </div>
                <Button
                  asChild
                  className="h-12 px-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  <a
                    href="https://buy.stripe.com/14A28k1496AhcPKf6924000"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Reserve your spot for the Signed launch event"
                  >
                    Reserve Your Spot
                  </a>
                </Button>
              </motion.div>

              {/* Secondary CTA */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}>
                <Link
                  to="/write"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm group border-b border-transparent hover:border-muted-foreground/30 pb-0.5"
                >
                  <span>Write for the future</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right side - Editorial photograph */}
            <motion.div
              className="relative hidden lg:block -mr-12 lg:-mr-24 xl:-mr-32"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              <div className="relative aspect-[4/5] w-full ml-auto overflow-hidden rounded-sm">
                {/* Soft overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent z-10" />
                <img src={heroImage} alt="Person writing in a notebook" className="w-full h-full object-cover" />
              </div>
              {/* Subtle decorative accent */}
              <div className="absolute -bottom-4 -left-4 w-24 h-24 border border-border/30 rounded-sm -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="relative z-10 py-24 bg-card/30">
        <div className="container mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-editorial text-3xl md:text-4xl text-foreground mb-4">How it works</h2>
            <div className="w-12 h-px bg-foreground/20 mx-auto" />
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-8 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="text-center space-y-4"
              >
                <div className="w-12 h-12 mx-auto flex items-center justify-center text-muted-foreground">
                  <step.icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="font-editorial text-xl text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto font-body">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/20">
        <div className="container mx-auto px-6 md:px-12 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body">About</Link>
              <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body">FAQ</Link>
              <a
                href="https://www.instagram.com/signed_letters"
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
            <span className="text-muted-foreground text-sm font-body">Write through time</span>
          </div>
        </div>
      </footer>

      {/* Tally Feedback Button */}
      <button
        data-tally-open="VLzk5E"
        data-tally-emoji-text="💬"
        data-tally-emoji-animation="wave"
        className="fixed bottom-6 right-6 p-4 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl z-50 flex items-center justify-center"
        aria-label="Give feedback"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Index;
