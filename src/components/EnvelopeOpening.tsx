import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Letter } from "@/hooks/useLetters";

interface EnvelopeOpeningProps {
  letter: Letter;
  onClose: () => void;
}

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
      <AnimatePresence mode="wait">
        {(stage === "envelope" || stage === "opening") && (
          <motion.div key="envelope" className="relative" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0, y: -100 }} transition={{ duration: 0.5 }}>
            <div className="relative w-72 h-52" style={{ perspective: "800px" }}>
              <svg viewBox="0 0 160 110" className="w-full h-full drop-shadow-2xl">
                <rect x="5" y="30" width="150" height="75" rx="4" fill="hsl(var(--envelope-cream))" stroke="hsl(var(--border))" strokeWidth="1.5" />
                <motion.rect x="15" y="35" width="130" height="60" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="0.5" animate={stage === "opening" ? { y: 10 } : { y: 35 }} transition={{ duration: 1, delay: 0.5 }} />
                <motion.g style={{ transformOrigin: "80px 30px" }} animate={stage === "opening" ? { rotateX: -180, opacity: 0 } : { rotateX: 0, opacity: 1 }} transition={{ duration: 0.8 }}>
                  <path d="M 5 30 L 80 60 L 155 30 Z" fill="hsl(var(--cream))" stroke="hsl(var(--border))" strokeWidth="1.5" />
                </motion.g>
                <motion.g transform="translate(80, 48)" animate={stage === "opening" ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                  <circle cx="0" cy="0" r="10" className="wax-seal" fill="hsl(var(--seal-maroon))" />
                  <line x1="-4" y1="0" x2="2" y2="0" stroke="hsl(var(--primary-foreground))" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="5" cy="0" r="1.5" fill="hsl(var(--primary-foreground))" />
                </motion.g>
              </svg>
            </div>
            <div className="text-center mt-4">
              <h3 className="font-editorial text-xl text-primary-foreground">{letter.title}</h3>
              <p className="text-primary-foreground/70 text-sm font-body">{letter.date}</p>
            </div>
          </motion.div>
        )}

        {stage === "letter" && (
          <motion.div key="letter" className="bg-card/95 backdrop-blur-lg rounded-2xl shadow-dreamy max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 border border-border" initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
            <div className="paper-texture min-h-[300px] p-6 rounded-xl border border-border bg-paper">
              <h2 className="font-editorial text-2xl text-foreground mb-6">{letter.title}</h2>
              {letter.isTyped ? (
                <p className="text-foreground leading-relaxed whitespace-pre-wrap font-body">{letter.body || ""}</p>
              ) : (
                letter.sketchData && <img src={letter.sketchData} alt="Handwritten letter" className="w-full rounded-lg" />
              )}
              {letter.photos && letter.photos.length > 0 && (
                <div className="flex gap-3 mt-6">
                  {letter.photos.map((photo, index) => (
                    <img key={index} src={photo} alt={`Attachment ${index + 1}`} className="w-24 h-24 object-cover rounded-lg border border-border shadow-editorial" />
                  ))}
                </div>
              )}
              <p className={`text-xl mt-8 text-foreground ${letter.signatureFont || "font-signature"}`}>{letter.signature}</p>
            </div>
            <p className="text-center text-muted-foreground mt-6 font-editorial italic text-sm">This moment was worth waiting for.</p>
            <button onClick={onClose} className="mt-6 w-full py-3 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-all shadow-editorial">
              Close Letter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EnvelopeOpening;
