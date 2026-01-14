import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox, Send } from "lucide-react";
import Logo from "@/components/Logo";
import EnvelopeCard from "@/components/EnvelopeCard";
import EnvelopeOpening from "@/components/EnvelopeOpening";
import FloatingEmojis from "@/components/FloatingEmojis";
import { Button } from "@/components/ui/button";
import { useLetterStore, Letter } from "@/stores/letterStore";
import { format } from "date-fns";

const Vault = () => {
  const [activeTab, setActiveTab] = useState<"received" | "sent">("sent");
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
    <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
      {/* Floating Emojis Background */}
      <FloatingEmojis count={8} />

      {/* Decorative gradient orbs */}
      <div className="absolute top-20 right-10 w-48 h-48 rounded-full bg-pastel-lavender/30 blur-3xl" />
      <div className="absolute bottom-40 left-20 w-64 h-64 rounded-full bg-pastel-mint/30 blur-3xl" />

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <Logo size="sm" animate={false} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-2">
            Your Vault
          </h1>
          <p className="text-center text-muted-foreground mb-8">🦋 Where your letters wait</p>

          {/* Tab Toggle */}
          <div className="flex justify-center gap-3 mb-12">
            <Button
              variant={activeTab === "received" ? "default" : "outline"}
              onClick={() => setActiveTab("received")}
              className="shadow-soft"
            >
              <Inbox className="w-4 h-4 mr-2" />
              Received
            </Button>
            <Button
              variant={activeTab === "sent" ? "default" : "outline"}
              onClick={() => setActiveTab("sent")}
              className="shadow-soft"
            >
              <Send className="w-4 h-4 mr-2" />
              Sent
            </Button>
          </div>

          {/* Letters Grid */}
          {filteredLetters.length > 0 ? (
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
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 opacity-50">
                <Logo size="lg" animate={false} />
              </div>
              <p className="text-muted-foreground text-lg mb-2">
                {activeTab === "sent" 
                  ? "No letters sent yet ☁️"
                  : "No letters received yet 🌙"}
              </p>
              <p className="text-muted-foreground text-sm">
                {activeTab === "sent" 
                  ? "Write your first letter and send it to the future!"
                  : "They're on their way through time..."}
              </p>
              {activeTab === "sent" && (
                <Button asChild className="mt-6 shadow-soft">
                  <Link to="/write">✨ Write a Letter</Link>
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* Envelope Opening Modal */}
      <AnimatePresence>
        {selectedLetter && (
          <EnvelopeOpening
            letter={selectedLetter}
            onClose={() => setSelectedLetter(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Vault;
