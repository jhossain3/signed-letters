import { motion } from "framer-motion";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

const Logo = ({ size = "md", animate = true }: LogoProps) => {
  const sizes = {
    sm: { wrapper: "w-12 h-10", heart: "w-4 h-4" },
    md: { wrapper: "w-20 h-16", heart: "w-6 h-6" },
    lg: { wrapper: "w-32 h-24", heart: "w-10 h-10" },
  };

  const { wrapper } = sizes[size];

  return (
    <motion.div
      className={`relative ${wrapper}`}
      animate={animate ? { y: [0, -12, 0] } : undefined}
      transition={animate ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {/* Envelope body */}
      <svg viewBox="0 0 100 75" className="w-full h-full drop-shadow-soft">
        {/* Envelope back */}
        <rect
          x="5"
          y="15"
          width="90"
          height="55"
          rx="6"
          fill="hsl(var(--envelope-cream))"
          stroke="hsl(var(--pastel-rose))"
          strokeWidth="1.5"
        />
        
        {/* Envelope flap (back part visible) */}
        <path
          d="M 5 20 L 50 50 L 95 20"
          fill="none"
          stroke="hsl(var(--pastel-rose))"
          strokeWidth="1"
          opacity="0.5"
        />
        
        {/* Envelope front flap */}
        <path
          d="M 5 15 L 50 45 L 95 15 L 95 20 L 50 50 L 5 20 Z"
          fill="hsl(var(--pastel-cream))"
          stroke="hsl(var(--pastel-rose))"
          strokeWidth="1.5"
        />
        
        {/* Heart seal - now soft rose pink */}
        <g transform="translate(50, 45)">
          <circle
            cx="0"
            cy="0"
            r="12"
            fill="hsl(var(--seal-rose))"
            className="drop-shadow-md"
          />
          <path
            d="M 0 -5 C -3 -8 -7 -7 -7 -3 C -7 1 0 6 0 6 C 0 6 7 1 7 -3 C 7 -7 3 -8 0 -5"
            fill="white"
          />
        </g>
      </svg>
    </motion.div>
  );
};

export default Logo;
