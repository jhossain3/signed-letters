import { motion } from "framer-motion";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  showText?: boolean;
}

const Logo = ({ size = "md", animate = true, showText = false }: LogoProps) => {
  const sizes = {
    sm: { wrapper: "h-6", width: 24, height: 16, lineWidth: 18, dotSize: 3, text: "text-lg" },
    md: { wrapper: "h-8", width: 32, height: 20, lineWidth: 24, dotSize: 4, text: "text-xl" },
    lg: { wrapper: "h-12", width: 40, height: 26, lineWidth: 30, dotSize: 5, text: "text-3xl" },
  };

  const { wrapper, width, height, lineWidth, dotSize, text } = sizes[size];

  // Line positioned in lower half, dot above and to the right with safe padding
  const padding = dotSize;
  const lineY = height * 0.65;
  const dotX = lineWidth + dotSize + 10;
  const dotY = height * 0.35;

  return (
    <motion.div
      className={`flex items-center gap-3 ${wrapper}`}
      animate={animate ? { y: [0, -2, 0] } : undefined}
      transition={animate ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {/* Minimalist logo mark: horizontal line + dot above right */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
        {/* Thin horizontal line with squared ends */}
        <motion.line
          x1="0"
          y1={lineY}
          x2={lineWidth}
          y2={lineY}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          className="text-foreground"
          initial={animate ? { pathLength: 0, opacity: 0 } : undefined}
          animate={animate ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        {/* Small solid dot - above and to the right, not touching */}
        <motion.circle
          cx={dotX}
          cy={dotY}
          r={dotSize}
          fill="currentColor"
          className="text-foreground"
          initial={animate ? { scale: 0, opacity: 0 } : undefined}
          animate={animate ? { scale: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.3, delay: 0.5 }}
        />
      </svg>

      {showText && (
        <motion.span
          className={`font-editorial font-normal tracking-wide text-foreground lowercase ${text}`}
          initial={animate ? { opacity: 0, x: -8 } : undefined}
          animate={animate ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          signed
        </motion.span>
      )}
    </motion.div>
  );
};

export default Logo;
