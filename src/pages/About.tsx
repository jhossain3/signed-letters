import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 paper-texture pointer-events-none opacity-50" />

      <main className="container mx-auto px-6 md:px-12 py-16 relative z-10 flex-1">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-12"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-body">Back</span>
        </Link>

        <div className="max-w-2xl mx-auto">
          <h1 className="font-editorial text-4xl md:text-5xl text-foreground mb-6">About</h1>
          <div className="w-12 h-px bg-foreground/20 mb-8" />
          <p className="text-muted-foreground text-lg leading-relaxed font-body">
            Content coming soon.
          </p>
        </div>
      </main>
    </div>
  );
};

export default About;
