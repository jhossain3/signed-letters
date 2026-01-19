import { motion } from "framer-motion";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  showText?: boolean;
}

const Logo = ({ size = "md", animate = true, showText = false }: LogoProps) => {
  const sizes = {
    sm: { wrapper: "h-6", line: 40, dot: 6, text: "text-lg" },
    md: { wrapper: "h-8", line: 50, dot: 8, text: "text-xl" },
    lg: { wrapper: "h-12", line: 70, dot: 10, text: "text-3xl" },
  };

  const { wrapper, line, dot, text } = sizes[size];

  return (
    <motion.div
      className={`flex items-center gap-2 ${wrapper}`}
      animate={animate ? { y: [0, -4, 0] } : undefined}
      transition={animate ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {/* Signature-inspired logo: horizontal line + dot */}
      <svg 
        width={line} 
        height={dot * 2} 
        viewBox={`0 0 ${line} ${dot * 2}`} 
        className="flex-shrink-0"
      >
        {/* Horizontal signature line */}
        <motion.line
          x1="0"
          y1={dot}
          x2={line - dot - 4}
          y2={dot}
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Dot at the end */}
        <motion.circle
          cx={line - dot / 2}
          cy={dot}
          r={dot / 2}
          fill="hsl(var(--primary))"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        />
      </svg>
      
      {showText && (
        <motion.span 
          className={`font-editorial font-medium text-foreground ${text}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          signed
        </motion.span>
      )}
    </motion.div>
  );
};

export default Logo;
