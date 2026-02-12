import { Link } from "react-router-dom";
import { Instagram, Linkedin } from "lucide-react";
import Logo from "./Logo";

const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-card/30">
      <div className="container mx-auto px-6 md:px-12 py-10">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
          {/* Left — Logo + tagline */}
          <div className="flex flex-col items-start space-y-2">
            <Logo />
            <span className="text-muted-foreground text-sm font-editorial tracking-wide">Write through time</span>
          </div>

          {/* Right — Explore + Contact */}
          <div className="flex gap-12 sm:gap-16">
            {/* Explore */}
            <div className="flex flex-col space-y-3">
              <span className="text-foreground text-sm font-editorial tracking-wide">Explore</span>
              <div className="flex flex-col gap-2">
                <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body">About</Link>
                <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body">FAQ</Link>
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-col items-start space-y-3">
              <span className="text-foreground text-sm font-editorial tracking-wide">Contact</span>
              <div className="flex items-center gap-4">
                <a
                  href="https://www.instagram.com/signed_letters"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Follow us on Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="https://www.tiktok.com/@letters_for_later"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Follow us on TikTok"
                >
                  <TikTokIcon />
                </a>
                <a
                  href="https://www.linkedin.com/company/signed-letters/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Follow us on LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
              <a
                href="mailto:help@notify.signedletter.com"
                onClick={(e) => {
                  const timeout = setTimeout(() => {
                    navigator.clipboard.writeText("help@notify.signedletter.com").catch(() => {});
                  }, 500);
                  window.addEventListener("blur", () => clearTimeout(timeout), { once: true });
                }}
                className="text-muted-foreground hover:text-foreground transition-colors text-xs font-body"
              >
                help@notify.signedletter.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
