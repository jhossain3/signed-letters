import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileEdit, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Draft, useDrafts } from "@/hooks/useDrafts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DraftsListProps {
  onLoadDraft: (draft: Draft) => void;
  onClose?: () => void;
  inline?: boolean; // If true, renders inline instead of as a modal
}

const DraftsList = ({ onLoadDraft, onClose, inline = false }: DraftsListProps) => {
  const { drafts, isLoading, deleteDraft, isDeletingDraft } = useDrafts();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteDraft(deleteId);
    setDeleteId(null);
  };

  const content = (
    <div className="space-y-3">
      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading drafts...</p>
        </div>
      ) : drafts.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 font-body">No drafts yet</p>
      ) : (
        drafts.map((draft) => (
          <motion.div
            key={draft.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 bg-card/80 rounded-xl border border-border/50 hover:border-border transition-colors"
          >
            <div className="flex-1 min-w-0 mr-3">
              <p className="font-editorial text-foreground truncate">
                {draft.title?.trim() || "Untitled Letter"}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {draft.recipientType === "myself"
                  ? "To myself"
                  : `To ${draft.recipientEmail || "someone"}`}
                {" · "}
                {format(new Date(draft.updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLoadDraft(draft)}
                className="rounded-full"
              >
                <FileEdit className="w-3.5 h-3.5 mr-1" />
                Continue
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(draft.id)}
                disabled={isDeletingDraft}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This draft will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (inline) return content;

  // Modal wrapper
  return (
    <motion.div
      className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-card rounded-2xl shadow-dreamy max-w-lg w-full max-h-[70vh] overflow-y-auto p-6 border border-border cursor-auto"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-editorial text-xl text-foreground">Your Drafts</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>
        {content}
      </motion.div>
    </motion.div>
  );
};

export default DraftsList;
