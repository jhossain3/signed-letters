import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle } from "lucide-react";
import Footer from "@/components/Footer";
import DraftsList from "@/components/DraftsList";
import { Draft } from "@/hooks/useDrafts";
import { useAuth } from "@/contexts/AuthContext";

const Drafts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLoadDraft = (draft: Draft) => {
    navigate("/write", { state: { loadDraft: draft } });
  };

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-body">Back</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl relative z-10 flex-1">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-10">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">My Drafts</h1>
            <p className="text-muted-foreground font-body">Letters still in progress</p>
            {user?.email && <p className="text-xs text-muted-foreground/70 mt-1">{user.email}</p>}
          </div>

          <DraftsList onLoadDraft={handleLoadDraft} inline />
        </motion.div>
      </main>

      <Footer />

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
    </div>
  );
};

export default Drafts;
