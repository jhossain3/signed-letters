import { Link } from "react-router-dom";
import { Moon, Sun, Archive, PenLine, LogOut, LogIn, UserCircle, FileText, CalendarDays, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURE_FLAGS } from "@/config/featureFlags";

const AVATAR_EMOJIS: Record<string, string> = {
  cat: "🐱", dog: "🐶", fox: "🦊", owl: "🦉", bear: "🐻",
  butterfly: "🦋", flower: "🌸", star: "⭐", heart: "💜", moon: "🌙", sun: "☀️",
};
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const avatarId = user?.user_metadata?.avatar || "initials";
  const userInitials = (user?.email || "").split("@")[0].slice(0, 2).toUpperCase();

  const renderNavAvatar = () => {
    if (avatarId !== "initials" && AVATAR_EMOJIS[avatarId]) {
      return <span className="text-lg leading-none">{AVATAR_EMOJIS[avatarId]}</span>;
    }
    if (user) {
      return <span className="text-xs font-semibold font-serif">{userInitials}</span>;
    }
    return <UserCircle className="h-5 w-5" />;
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

          {/* Account dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account">
                {renderNavAvatar()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {FEATURE_FLAGS.AUTH_ENABLED && !user && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/auth" className="flex items-center gap-2 cursor-pointer">
                      <LogIn className="h-4 w-4" />
                      Sign in / Sign up
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to="/write" className="flex items-center gap-2 cursor-pointer">
                  <PenLine className="h-4 w-4" />
                  Write
                </Link>
              </DropdownMenuItem>
              {FEATURE_FLAGS.AUTH_ENABLED && user && (
                <DropdownMenuItem asChild>
                  <Link to="/drafts" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="h-4 w-4" />
                    My Drafts
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/vault" className="flex items-center gap-2 cursor-pointer">
                  <Archive className="h-4 w-4" />
                  My Vault
                </Link>
              </DropdownMenuItem>
              {FEATURE_FLAGS.AUTH_ENABLED && user && (
                <DropdownMenuItem asChild>
                  <Link to="/my-events" className="flex items-center gap-2 cursor-pointer">
                    <CalendarDays className="h-4 w-4" />
                    Events
                  </Link>
                </DropdownMenuItem>
              )}
              {FEATURE_FLAGS.AUTH_ENABLED && user && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 cursor-pointer">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
