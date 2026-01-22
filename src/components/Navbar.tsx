import { Link } from "react-router-dom";
import { Moon, Sun, Archive, PenLine, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left - Logo */}
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Logo size="sm" animate={false} showText />
        </Link>

        {/* Right - Navigation items */}
        <div className="flex items-center gap-2">
          {/* Night mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Write letter link */}
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/write" aria-label="Write a letter">
              <PenLine className="h-5 w-5" />
            </Link>
          </Button>

          {/* Vault link */}
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/vault" aria-label="Vault">
              <Archive className="h-5 w-5" />
            </Link>
          </Button>

          {/* Sign out button - only show when logged in */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="rounded-full"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
