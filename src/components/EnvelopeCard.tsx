import { motion } from "framer-motion";
import { useState } from "react";
import { X } from "lucide-react";

interface EnvelopeCardProps {
  id: string;
  title: string;
  date: string;
  isOpenable: boolean;
  onClick: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

const EnvelopeCard = ({ title, date, isOpenable, onClick, onDelete, canDelete }: EnvelopeCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="relative cursor-pointer group"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Delete button */}
      {canDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
          title="Delete letter"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="relative w-44 h-32 mx-auto">
        <svg viewBox="0 0 120 90" className="w-full h-full drop-shadow-lg">
          {/* Envelope back */}
          <rect
            x="5"
            y="20"
            width="110"
            height="65"
            rx="4"
            fill="hsl(var(--envelope-cream))"
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
          
          {isOpenable ? (
            <>
              {/* Closed envelope flap without seal - simple closed look */}
              <path
                d="M 5 20 L 60 50 L 115 20"
                fill="hsl(var(--cream))"
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
            </>
          ) : (
            <>
              {/* Closed envelope flap */}
              <path
                d="M 5 20 L 60 50 L 115 20"
                fill="hsl(var(--cream))"
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
              {/* Wax seal with logo - centered on flap */}
              <g transform="translate(60, 48)">
                <circle 
                  cx="0" 
                  cy="0" 
                  r="12" 
                  className="wax-seal"
                  fill="hsl(var(--seal-maroon))"
                />
                {/* Logo mark - horizontal line + dot above right */}
                <line
                  x1="-5"
                  y1="1"
                  x2="3"
                  y2="1"
                  stroke="hsl(var(--primary-foreground))"
                  strokeWidth="1.5"
                  strokeLinecap="square"
                />
                <circle
                  cx="6"
                  cy="-2"
                  r="2"
                  fill="hsl(var(--primary-foreground))"
                />
              </g>
            </>
          )}
        </svg>

        {/* Hover overlay */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-foreground/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered && isOpenable ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-primary-foreground font-editorial text-base font-medium">
            Open
          </span>
        </motion.div>

        {/* Sealed indicator */}
        {!isOpenable && (
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <div className="bg-card/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-muted-foreground shadow-editorial border border-border/50">
              Until {date}
            </div>
          </div>
        )}
      </div>

      <div className="text-center mt-3">
        <p className="font-editorial text-foreground font-medium text-sm truncate max-w-[160px] mx-auto">{title}</p>
        <p className="text-xs text-muted-foreground font-body">{date}</p>
      </div>
    </motion.div>
  );
};

export default EnvelopeCard;