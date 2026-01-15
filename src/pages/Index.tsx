import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Camera, Clock, Mail } from "lucide-react";
import Logo from "@/components/Logo";
import FeatureCard from "@/components/FeatureCard";
import WaitlistForm from "@/components/WaitlistForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const FEATURE_COLORS = ["#f5f0e8", "#ede8f2", "#e8eef2"];
const Index = () => {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-pastel-sand/20 blur-3xl" />
      <div className="absolute top-40 right-20 w-48 h-48 rounded-full bg-pastel-lavender/20 blur-3xl" />
      <div className="absolute bottom-20 left-1/3 w-56 h-56 rounded-full bg-pastel-sky/20 blur-3xl" />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Animated Logo */}
          <Logo size="lg" animate />

          {/* Tagline */}
          <motion.h1
            className="font-serif text-4xl md:text-6xl font-bold text-foreground mt-8 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            sign it off.
          </motion.h1>

          <motion.p
            className="text-muted-foreground text-lg md:text-xl max-w-2xl leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Your digital space to write and send meaningful letters to your future self and the people you love. Write
            something special today, and I'll keep it safe.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Button asChild size="lg" className="text-lg px-8 py-6 shadow-soft">
              <Link to="/write">Write a Letter</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 bg-card/50 backdrop-blur-sm">
              <Link to="/vault">Explore Vault</Link>
            </Button>
          </motion.div>

          {/* Join Waitlist Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-6"
          >
            <Dialog open={isWaitlistOpen} onOpenChange={setIsWaitlistOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="lg" className="text-lg">
                  Join Waitlist
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl text-center">
                    Join the Waitlist
                  </DialogTitle>
                </DialogHeader>
                <WaitlistForm onSuccess={() => {}} />
              </DialogContent>
            </Dialog>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Camera className="w-6 h-6" />,
              title: "Capture Moments",
              description: "Attach your favorite photos to capture more than just words.",
              color: FEATURE_COLORS[0],
            },
            {
              icon: <Mail className="w-6 h-6" />,
              title: "Beautiful Reveal",
              description: "A beautiful, slow-reveal experience designed to feel like opening a real letter.",
              color: FEATURE_COLORS[1],
            },
            {
              icon: <Clock className="w-6 h-6" />,
              title: "Time Capsule",
              description: "Your message travels through time safely, arriving exactly when you promised it.",
              color: FEATURE_COLORS[2],
            },
          ].map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              delay={0.2 + index * 0.2}
            />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center relative z-10">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Logo size="sm" animate={false} />
          <span className="font-serif text-lg">Signed</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
