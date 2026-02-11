import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Inbox, Send, LayoutGrid, GitBranch, Instagram, MessageCircle } from "lucide-react";

import EnvelopeCard from "@/components/EnvelopeCard";
import EnvelopeOpening from "@/components/EnvelopeOpening";
import { Button } from "@/components/ui/button";
import { useLetters, Letter } from "@/hooks/useLetters";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { format, addDays, subDays } from "date-fns";
import { toast } from "sonner";
import { needsMigration, migrateLettersToRandomKey } from "@/lib/migrateLegacyEncryption";

const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

// Demo letters for when auth is disabled
const DEMO_LETTERS: Letter[] = [
  {
    id: "demo-sent-1",
    title: "Note to Future Me",
    body: "Dear future me, I hope you're doing well and have achieved everything you set out to do...",
    date: "January 15, 2026",
    deliveryDate: addDays(new Date(), 30).toISOString(),
    signature: "With hope",
    recipientType: "myself",
    type: "sent",
    createdAt: subDays(new Date(), 5).toISOString(),
    photos: [],
    isTyped: true,
    isLined: true,
  },
  {
    id: "demo-sent-2",
    title: "Graduation Wishes",
    body: "Congratulations on your graduation! Remember how hard you worked to get here...",
    date: "January 10, 2026",
    deliveryDate: subDays(new Date(), 2).toISOString(), // Openable
    signature: "Your past self",
    recipientType: "myself",
    type: "sent",
    createdAt: subDays(new Date(), 10).toISOString(),
    photos: [],
    isTyped: true,
    isLined: false,
  },
  {
    id: "demo-sent-3",
    title: "Birthday Surprise",
    body: "Happy birthday! I wrote this months ago hoping you'd have an amazing day...",
    date: "December 20, 2025",
    deliveryDate: addDays(new Date(), 180).toISOString(),
    signature: "Past You",
    recipientType: "myself",
    type: "sent",
    createdAt: subDays(new Date(), 30).toISOString(),
    photos: [],
    isTyped: true,
    isLined: true,
  },
  {
    id: "demo-received-1",
    title: "From Mom",
    body: "My dearest, I wanted to write you something special that you can read whenever you need encouragement...",
    date: "January 12, 2026",
    deliveryDate: subDays(new Date(), 1).toISOString(), // Openable
    signature: "Love, Mom",
    recipientType: "someone",
    type: "received",
    createdAt: subDays(new Date(), 7).toISOString(),
    photos: [],
    isTyped: true,
    isLined: true,
  },
  {
    id: "demo-received-2",
    title: "Anniversary Note",
    body: "To my love, by the time you read this, we'll have been together for another wonderful year...",
    date: "January 5, 2026",
    deliveryDate: addDays(new Date(), 60).toISOString(),
    signature: "Forever yours",
    recipientType: "someone",
    type: "received",
    createdAt: subDays(new Date(), 14).toISOString(),
    photos: [],
    isTyped: true,
    isLined: false,
  },
];

const Vault = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"received" | "sent">("sent");
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isWaitingForLetter, setIsWaitingForLetter] = useState(false);

  const location = useLocation();
  const { letters: dbLetters, isLoading, isLetterOpenable } = useLetters();
  const { signOut, user } = useAuth();

  // Check if we're waiting for a new letter to appear (after redirect from WriteLetter)
  const newLetterId = (location.state as { newLetterId?: string } | null)?.newLetterId;

  useEffect(() => {
    if (newLetterId && FEATURE_FLAGS.AUTH_ENABLED) {
      // Check if the letter is already in the list
      const letterExists = dbLetters.some((letter) => letter.id === newLetterId);
      if (letterExists) {
        setIsWaitingForLetter(false);
        // Clear the navigation state
        window.history.replaceState({}, document.title);
      } else if (!isLoading) {
        // Letter not found yet and not loading - keep waiting
        setIsWaitingForLetter(true);
      }
    } else {
      setIsWaitingForLetter(false);
    }
  }, [newLetterId, dbLetters, isLoading]);

  // Auto-migrate legacy encrypted letters
  useEffect(() => {
    const runMigration = async () => {
      if (!user?.id || !user?.email || isMigrating) return;

      try {
        const needsMig = await needsMigration(user.id);
        if (needsMig) {
          setIsMigrating(true);
          toast.info("Migrating to new encryption...");

          const result = await migrateLettersToRandomKey(user.id, user.email);

          if (result.success && result.migratedCount > 0) {
            toast.success(`Migrated ${result.migratedCount} successfully!`);
            // Refresh the page to reload letters with new keys
            window.location.reload();
          } else if (!result.success) {
            toast.error("Migration failed: " + result.error);
          }
          setIsMigrating(false);
        }
      } catch (error) {
        console.error("Migration check failed:", error);
        setIsMigrating(false);
      }
    };

    runMigration();
  }, [user?.id, user?.email]);

  // Use demo letters when auth is disabled, otherwise use real letters
  const letters = FEATURE_FLAGS.AUTH_ENABLED ? dbLetters : DEMO_LETTERS;

  const filteredLetters = letters
    .filter((letter) => {
      if (activeTab === "sent") return letter.type === "sent";
      return letter.type === "received";
    })
    .sort((a, b) => {
      // Sort by delivery date (date of receipt) - newest first
      return new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime();
    });

  const handleEnvelopeClick = (letter: Letter) => {
    if (isLetterOpenable(letter)) {
      setSelectedLetter(letter);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (isLoading || isMigrating || isWaitingForLetter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-editorial">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-body">
            {isMigrating
              ? "Migrating your entries..."
              : isWaitingForLetter
                ? "Sealing your words..."
                : "Loading your entries..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-body">Back</span>
          </button>
          <div />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10 flex-1">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-10">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">Your Vault</h1>
            <p className="text-muted-foreground font-body">Where your thoughts wait</p>
            {user?.email && <p className="text-xs text-muted-foreground/70 mt-1">{user.email}</p>}
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "sent" ? "default" : "outline"}
                onClick={() => setActiveTab("sent")}
                className="rounded-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Sent
              </Button>
              <Button
                variant={activeTab === "received" ? "default" : "outline"}
                onClick={() => setActiveTab("received")}
                className="rounded-full"
              >
                <Inbox className="w-4 h-4 mr-2" />
                Received
              </Button>
            </div>
            <div className="flex gap-1 bg-card/50 rounded-full p-1 border border-border/50">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-full transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`p-2 rounded-full transition-colors ${viewMode === "timeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <GitBranch className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Letters Display */}
          {filteredLetters.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {filteredLetters.map((letter, index) => (
                  <motion.div
                    key={letter.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <EnvelopeCard
                      id={letter.id}
                      title={letter.title}
                      date={format(new Date(letter.deliveryDate), "MMM d, yyyy")}
                      isOpenable={isLetterOpenable(letter)}
                      onClick={() => handleEnvelopeClick(letter)}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="relative max-w-2xl mx-auto">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />
                {filteredLetters.map((letter, index) => (
                  <motion.div
                    key={letter.id}
                    className={`relative flex ${index % 2 === 0 ? "justify-start pr-1/2" : "justify-end pl-1/2"} mb-8`}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className="absolute left-1/2 top-1/2 w-3 h-3 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2 z-10" />
                    <div className={`w-5/12 ${index % 2 === 0 ? "mr-8" : "ml-8"}`}>
                      <EnvelopeCard
                        id={letter.id}
                        title={letter.title}
                        date={format(new Date(letter.deliveryDate), "MMM d, yyyy")}
                        isOpenable={isLetterOpenable(letter)}
                        onClick={() => handleEnvelopeClick(letter)}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2 font-body">
                {activeTab === "sent" ? "Nothing sent yet" : "Nothing received yet"}
              </p>
              {activeTab === "sent" && (
                <Button asChild className="mt-6 rounded-full">
                  <Link to="/write">Write now, open later</Link>
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-border/50 bg-card/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-body">Words through time</span>
            <div className="flex items-center gap-6">
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body">About</Link>
              <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-body">FAQ</Link>
              <a
                href="https://www.instagram.com/signed_letters"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://www.tiktok.com/@letters_for_later"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <TikTokIcon />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Tally Feedback Button */}
      <button
        data-tally-open="VLzk5E"
        data-tally-emoji-text="💬"
        data-tally-emoji-animation="wave"
        className="fixed bottom-6 right-6 p-4 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl z-50 flex items-center justify-center"
        aria-label="Give feedback"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {selectedLetter && <EnvelopeOpening letter={selectedLetter} onClose={() => setSelectedLetter(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default Vault;
