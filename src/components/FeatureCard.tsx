import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  color?: string;
  delay?: number;
}

const FeatureCard = ({ icon, title, description, color, delay = 0 }: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 shadow-dreamy hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      <div 
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: color || 'hsl(var(--secondary))' }}
      >
        <span className="text-foreground/70">{icon}</span>
      </div>
      <h3 className="font-serif text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
};

export default FeatureCard;
