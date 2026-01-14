import { motion } from "framer-motion";

const EMOJIS = ['✨', '☁️', '🌙', '🌟', '✉️', '🍃', '🪶', '·'];

interface FloatingEmojisProps {
  count?: number;
}

const FloatingEmojis = ({ count = 8 }: FloatingEmojisProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: count }).map((_, i) => {
        const emoji = EMOJIS[i % EMOJIS.length];
        const size = 16 + Math.random() * 16;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = i * 0.5;
        const duration = 4 + Math.random() * 4;

        return (
          <motion.span
            key={i}
            className="absolute text-lg opacity-40"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              fontSize: `${size}px`,
            }}
            animate={{
              y: [0, -15, 0],
              x: [0, 8, -5, 0],
              rotate: [0, 10, -10, 0],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {emoji}
          </motion.span>
        );
      })}
    </div>
  );
};

export default FloatingEmojis;
