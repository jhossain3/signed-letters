import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import Footer from "@/components/Footer";

const paragraphs = [
  {
    text: "Four friends with one idea: we've lost the ability to reflect.",
    highlight: true,
  },
  {
    text: "We met through work and reconnected at goal-setting sessions that made us ask: Why isn't there a better way to do this?",
  },
  {
    text: "Everything out there felt corporate, soulless, or just… wrong. So we did what any slightly delusional group of friends would do: we built what we wanted for ourselves.",
  },
  {
    text: "Supported by a network of thoughtful, values-driven people, we created signed — a place to capture what matters and lock it away until it's time.",
  },
  {
    text: "Write. Record a video. Sketch something. Add photos. Then seal it. You can't peek, edit, or take it back. We deliver it on the date you choose.",
    accent: true,
  },
  {
    text: "It's for your future self who needs the reminder. For your kid when they turn 18. For forcing yourself to pause when life won't slow down.",
  },
  {
    text: "At its heart, signed brings back something timeless: writing to your future, to the people you love. Moments preserved with intention, revealed on time.",
  },
  {
    text: "We made this to help people reflect, grow, and appreciate what matters before it's too late.",
  },
];

const About = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 paper-texture pointer-events-none opacity-50" />

      <main className="container mx-auto px-6 md:px-12 py-16 relative z-10 flex-1">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-16"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-body">Back</span>
        </button>

        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <h1 className="font-editorial text-4xl md:text-5xl text-foreground mb-4">About</h1>
            <div className="w-16 h-px bg-foreground/20" />
          </motion.div>

          {/* Body */}
          <div className="space-y-8">
            {paragraphs.map((p, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                className={
                  p.highlight
                    ? "font-editorial text-2xl md:text-3xl text-foreground leading-snug"
                    : p.accent
                      ? "text-foreground font-medium text-base md:text-lg leading-relaxed font-body border-l-2 border-primary/40 pl-5"
                      : "text-muted-foreground text-base md:text-lg leading-relaxed font-body"
                }
              >
                {p.text}
              </motion.p>
            ))}

            {/* Closing */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + paragraphs.length * 0.08 }}
              className="font-editorial text-xl md:text-2xl text-foreground pt-4"
            >
              Welcome to <em className="italic">signed</em>.
            </motion.p>
          </div>
        </div>
      </main>

      <Footer />

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

export default About;
