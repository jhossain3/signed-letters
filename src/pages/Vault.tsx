import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox, Send, LayoutGrid, GitBranch, Instagram } from "lucide-react";
import Logo from "@/components/Logo";
import EnvelopeCard from "@/components/EnvelopeCard";
import EnvelopeOpening from "@/components/EnvelopeOpening";
import { Button } from "@/components/ui/button";
import { useLetterStore, Letter } from "@/stores/letterStore";
import { format } from "date-fns";

const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const Vault = () => {
  const [activeTab, setActiveTab] = useState<"received" | "sent">("sent");
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  
  const { letters, isLetterOpenable } = useLetterStore();

  const filteredLetters = letters.filter((letter) => {
    if (activeTab === "sent") return letter.type === "sent";
    return letter.type === "received";
  });

  const handleEnvelopeClick = (letter: Letter) => {
    if (isLetterOpenable(letter)) {
      setSelectedLetter(letter);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden">
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-body">Back</span>
          </Link>
          <Logo size="sm" animate={false} showText />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-10">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">Your Vault</h1>
            <p className="text-muted-foreground font-body">Where your letters wait</p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
            <div className="flex gap-2">
              <Button variant={activeTab === "sent" ? "default" : "outline"} onClick={() => setActiveTab("sent")} className="rounded-full">
                <Send className="w-4 h-4 mr-2" />Sent
              </Button>
              <Button variant={activeTab === "received" ? "default" : "outline"} onClick={() => setActiveTab("received")} className="rounded-full">
                <Inbox className="w-4 h-4 mr-2" />Received
              </Button>
            </div>
            <div className="flex gap-1 bg-card/50 rounded-full p-1 border border-border/50">
              <button onClick={() => setViewMode("grid")} className={`p-2 rounded-full transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("timeline")} className={`p-2 rounded-full transition-colors ${viewMode === "timeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <GitBranch className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Letters Display */}
          {filteredLetters.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {filteredLetters.map((letter, index) => (
                  <motion.div key={letter.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.1 }}>
                    <EnvelopeCard id={letter.id} title={letter.title} date={format(new Date(letter.deliveryDate), "MMM d, yyyy")} isOpenable={isLetterOpenable(letter)} onClick={() => handleEnvelopeClick(letter)} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="relative max-w-2xl mx-auto">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />
                {filteredLetters.map((letter, index) => (
                  <motion.div key={letter.id} className={`relative flex ${index % 2 === 0 ? "justify-start pr-1/2" : "justify-end pl-1/2"} mb-8`} initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: index * 0.1 }}>
                    <div className="absolute left-1/2 top-1/2 w-3 h-3 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2 z-10" />
                    <div className={`w-5/12 ${index % 2 === 0 ? "mr-8" : "ml-8"}`}>
                      <EnvelopeCard id={letter.id} title={letter.title} date={format(new Date(letter.deliveryDate), "MMM d, yyyy")} isOpenable={isLetterOpenable(letter)} onClick={() => handleEnvelopeClick(letter)} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2 font-body">{activeTab === "sent" ? "No letters sent yet" : "No letters received yet"}</p>
              {activeTab === "sent" && <Button asChild className="mt-6 rounded-full"><Link to="/write">Write a Letter</Link></Button>}
            </div>
          )}
        </motion.div>
      </main>

      <footer className="relative z-10 mt-16 border-t border-border/50 bg-card/30">
        <div className="container mx-auto px-4 py-6 flex justify-center gap-6">
          <a href="https://www.instagram.com/signed.app" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors"><Instagram className="h-5 w-5" /></a>
          <a href="https://www.tiktok.com/@letters_for_later" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors"><TikTokIcon /></a>
        </div>
      </footer>

      <AnimatePresence>{selectedLetter && <EnvelopeOpening letter={selectedLetter} onClose={() => setSelectedLetter(null)} />}</AnimatePresence>
    </div>
  );
};

export default Vault;
