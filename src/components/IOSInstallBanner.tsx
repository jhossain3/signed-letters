import { useState, useEffect } from "react";
import { X } from "lucide-react";

const IOS_DISMISS_KEY = "signed-ios-install-dismissed";

/** Detects iOS Safari (not standalone / not already installed). */
function shouldShowIOSBanner(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;

  // Already running as installed PWA
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) return false;

  return true;
}

const IOSInstallBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(IOS_DISMISS_KEY)) return;
    if (shouldShowIOSBanner()) setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(IOS_DISMISS_KEY, "true");
  };

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card px-4 py-3 shadow-editorial">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {/* iOS Share icon (box with up-arrow) */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </div>

        <p className="flex-1 text-sm text-foreground">
          Install <span className="font-medium">signed</span> on your phone
          — tap{" "}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block align-text-bottom text-primary"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>{" "}
          then <span className="font-medium">"Add to Home Screen"</span>
        </p>

        <button
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss install banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default IOSInstallBanner;
