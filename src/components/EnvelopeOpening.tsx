import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface Letter {
  id: string;
  title: string;
  body: string;
  date: string;
  signature: string;
  photos?: string[];
  sketchData?: string;
  isTyped: boolean;
}

interface EnvelopeOpeningProps {
  letter: Letter;
  onClose: () => void;
}

const EMOJIS = ['✨', '☁️', '🌙', '🌟', '✉️', '🍃', '🪶', '·'];

const EnvelopeOpening = ({ letter, onClose }: EnvelopeOpeningProps) => {
  const [stage, setStage] = useState<"envelope" | "opening" | "letter">("envelope");

  useEffect(() => {
    if (stage === "envelope") {
      const timer = setTimeout(() => setStage("opening"), 500);
      return () => clearTimeout(timer);
    }
    if (stage === "opening") {
      const timer = setTimeout(() => setStage("letter"), 1500);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  return (
    <motion.div
      className="fixed inset-0 bg-foreground/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Floating emojis during reveal */}
      {stage === "opening" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {EMOJIS.map((emoji, i) => (
            <motion.span
              key={i}
              className="absolute text-2xl"
              initial={{ 
                x: `${50 + (Math.random() - 0.5) * 20}%`,
                y: "50%",
                opacity: 0,
                scale: 0
              }}
              animate={{ 
                x: `${Math.random() * 100}%`,
                y: `${Math.random() * 100}%`,
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0]
              }}
              transition={{ 
                duration: 1.5,
                delay: i * 0.1,
                ease: "easeOut"
              }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {(stage === "envelope" || stage === "opening") && (
          <motion.div
            key="envelope"
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0, y: -100 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative w-80 h-56">
              {/* Envelope body */}
              <svg viewBox="0 0 160 110" className="w-full h-full drop-shadow-2xl">
                {/* Envelope back */}
                <rect
                  x="5"
                  y="30"
                  width="150"
                  height="75"
                  rx="6"
                  fill="hsl(var(--envelope-cream))"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />
                
                {/* Letter peeking out */}
                <motion.rect
                  x="15"
                  y="35"
                  width="130"
                  height="60"
                  rx="4"
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--pastel-lavender))"
                  strokeWidth="1"
                  animate={stage === "opening" ? { y: 0 } : { y: 35 }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
                
                {/* Envelope flap */}
                <motion.path
                  d="M 5 30 L 80 70 L 155 30 L 155 35 L 80 75 L 5 35 Z"
                  fill="hsl(var(--pastel-cream))"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  style={{ transformOrigin: "80px 30px" }}
                  animate={stage === "opening" ? { rotateX: -180 } : { rotateX: 0 }}
                  transition={{ duration: 0.8 }}
                />
                
                {/* Heart seal */}
                <motion.g 
                  transform="translate(80, 60)"
                  animate={stage === "opening" ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <circle cx="0" cy="0" r="12" fill="hsl(var(--seal-warm))" />
                  <path
                    d="M 0 -5 C -3 -8 -7 -7 -7 -3 C -7 1 0 6 0 6 C 0 6 7 1 7 -3 C 7 -7 3 -8 0 -5"
                    fill="white"
                  />
                </motion.g>
              </svg>
            </div>
            
            <div className="text-center mt-4">
              <h3 className="font-serif text-2xl text-background">{letter.title}</h3>
              <p className="text-background/70">{letter.date}</p>
            </div>
          </motion.div>
        )}

        {stage === "letter" && (
          <motion.div
            key="letter"
            className="bg-card/95 backdrop-blur-lg rounded-2xl shadow-dreamy max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 border border-primary/30"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="paper-texture min-h-[400px] p-6 rounded-xl border border-border bg-paper">
              <h2 className="font-serif text-3xl text-foreground mb-6">{letter.title}</h2>
              
              {letter.isTyped ? (
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {letter.body}
                </p>
              ) : (
                letter.sketchData && (
                  <img 
                    src={letter.sketchData} 
                    alt="Handwritten letter" 
                    className="w-full rounded-lg"
                  />
                )
              )}

              {letter.photos && letter.photos.length > 0 && (
                <div className="flex gap-3 mt-6">
                  {letter.photos.map((photo, index) => (
                    <img 
                      key={index}
                      src={photo} 
                      alt={`Attachment ${index + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border-2 border-primary shadow-soft"
                    />
                  ))}
                </div>
              )}

              <p className="font-serif text-xl mt-8 text-foreground italic">
                {letter.signature}
              </p>
            </div>

            <p className="text-center text-muted-foreground mt-6 font-serif italic flex items-center justify-center gap-2">
              <span>✨</span>
              This moment was worth waiting for.
              <span>✨</span>
            </p>

            <button
              onClick={onClose}
              className="mt-6 w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all shadow-soft"
            >
              ✉️ Close Letter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EnvelopeOpening;
