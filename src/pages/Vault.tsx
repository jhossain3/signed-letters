import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Inbox, Send } from "lucide-react";
import Logo from "@/components/Logo";
import EnvelopeCard from "@/components/EnvelopeCard";
import EnvelopeOpening from "@/components/EnvelopeOpening";
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <Logo size="sm" animate={false} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-8">
            Your Vault
          </h1>

          {/* Tab Toggle */}
          <div className="flex justify-center gap-3 mb-12">
            <Button
              variant={activeTab === "received" ? "default" : "outline"}
              onClick={() => setActiveTab("received")}
            >
              <Inbox className="w-4 h-4 mr-2" />
              Received
            </Button>
            <Button
              variant={activeTab === "sent" ? "default" : "outline"}
              onClick={() => setActiveTab("sent")}
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
              <p className="text-muted-foreground text-lg">
                {activeTab === "sent" 
                  ? "No letters sent yet. Write your first letter!"
                  : "No letters received yet. They're on their way!"}
              </p>
              {activeTab === "sent" && (
                <Button asChild className="mt-6">
                  <Link to="/write">Write a Letter</Link>
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
