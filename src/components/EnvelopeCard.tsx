import { motion } from "framer-motion";
import { useState } from "react";

interface EnvelopeCardProps {
  id: string;
  title: string;
  date: string;
  isOpenable: boolean;
  onClick: () => void;
}

const COLORS = ['#f5f0e8', '#e8ebe4', '#e5ecf0', '#ede8f2', '#f0ebe5', '#eaece9', '#e8eef2'];

const EnvelopeCard = ({ title, date, isOpenable, onClick }: EnvelopeCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  return (
    <motion.div
      className="relative cursor-pointer"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative w-48 h-36 mx-auto">
        {/* Envelope body */}
        <svg viewBox="0 0 120 90" className="w-full h-full drop-shadow-lg">
          {/* Envelope back */}
          <rect
            x="5"
            y="20"
            width="110"
            height="65"
            rx="6"
            fill="hsl(var(--envelope-cream))"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
          />
          
          {/* Envelope flap */}
          <path
            d="M 5 20 L 60 55 L 115 20"
            fill="hsl(var(--pastel-cream))"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
          />
          
          {/* Heart seal */}
          <g transform="translate(60, 50)">
            <circle cx="0" cy="0" r="10" fill="hsl(var(--seal-warm))" />
            <path
              d="M 0 -4 C -2.5 -6.5 -5.5 -5.5 -5.5 -2.5 C -5.5 0.5 0 5 0 5 C 0 5 5.5 0.5 5.5 -2.5 C 5.5 -5.5 2.5 -6.5 0 -4"
              fill="white"
            />
          </g>
        </svg>

        {/* Hover overlay */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-foreground/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered && isOpenable ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-background font-serif text-lg font-medium flex items-center gap-2">
            ✨ Open Letter
          </span>
        </motion.div>

        {/* Locked overlay */}
        {!isOpenable && (
          <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-pastel-stone/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-foreground/70 shadow-soft">
            🌙 Sealed until {date}
          </div>
        </div>
      )}
      </div>

      <div className="text-center mt-3">
        <p className="font-serif text-foreground font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>
    </motion.div>
  );
};

export default EnvelopeCard;
