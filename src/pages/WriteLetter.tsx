import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Image,
  PenTool,
  Type,
  X,
  Check,
  Plus,
  Trash2,
  MessageCircle,
  Save,
} from "lucide-react";
import Footer from "@/components/Footer";
import SketchCanvas, { SketchCanvasRef } from "@/components/SketchCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addMonths, addYears, addDays } from "date-fns";
import { useLetters } from "@/hooks/useLetters";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryptionReady } from "@/hooks/useEncryptionReady";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { toast } from "sonner";
import { serializeMultiPage, deserializeMultiPage } from "@/lib/sketchSerialization";
import { supabase } from "@/integrations/supabase/client";
import { useDrafts, Draft } from "@/hooks/useDrafts";
import DraftsList from "@/components/DraftsList";

// Signature font options
const SIGNATURE_FONTS = [
  { name: "Elegant", class: "font-signature" },
  { name: "Handwritten", class: "font-handwritten" },
  { name: "Classic", class: "font-editorial italic" },
];

// Paper color options
const PAPER_COLORS = [
  { name: "Cream", value: "hsl(38, 35%, 97%)", class: "bg-paper" },
  { name: "White", value: "hsl(0, 0%, 100%)", class: "bg-white" },
  { name: "Blush", value: "hsl(5, 30%, 95%)", class: "bg-accent" },
  { name: "Sage", value: "hsl(120, 15%, 94%)", class: "bg-muted" },
];

// Ink color options
const INK_COLORS = [
  { name: "Ink", value: "hsl(15, 20%, 18%)", class: "text-ink" },
  { name: "Maroon", value: "hsl(358, 45%, 35%)", class: "text-primary" },
  { name: "Charcoal", value: "hsl(20, 8%, 30%)", class: "text-secondary" },
  { name: "Navy", value: "hsl(220, 40%, 25%)", class: "text-blue-900" },
];


const DRAFT_STORAGE_KEY = "letter-draft";

interface LetterDraft {
  recipientType: "myself" | "someone";
  recipientEmail: string;
  recipientName: string;
  title: string;
  deliveryDate: string | null;
  signature: string;
  signatureFont: (typeof SIGNATURE_FONTS)[0];
  inputMode: "type" | "sketch";
  showLines: boolean;
  paperColor: (typeof PAPER_COLORS)[0];
  inkColor: (typeof INK_COLORS)[0];
  textPages: string[];
  sketchPages: string[];
}

const uploadPhotosToStorage = async (
  files: File[],
  userId: string
): Promise<string[]> => {
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("letter-photos")
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    // Store the storage path, not a URL — signed URLs are generated on read
    paths.push(path);
  }
  return paths;
};

const WriteLetter = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addLetter, isAddingLetter } = useLetters();
  const { drafts, saveDraft: saveDraftToDb, isSavingDraft } = useDrafts();
  const {
    isReady: isEncryptionReady,
    isInitializing: isEncryptionInitializing,
    error: encryptionError,
  } = useEncryptionReady();

  const [recipientType, setRecipientType] = useState<"myself" | "someone">("myself");
  const [inputMode, setInputMode] = useState<"type" | "sketch">("type");
  const [title, setTitle] = useState("");
  // Separate page lists for text and sketch modes
  const [textPages, setTextPages] = useState<string[]>([""]);
  const [sketchPages, setSketchPages] = useState<string[]>([""]);
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [signature, setSignature] = useState("");
  const [signatureFont, setSignatureFont] = useState(SIGNATURE_FONTS[0]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [paperColor, setPaperColor] = useState(PAPER_COLORS[0]);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [showLines, setShowLines] = useState(true);
  const [isSealing, setIsSealing] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sketchCanvasRefs = useRef<Map<number, SketchCanvasRef>>(new Map());
  const letterScrollRef = useRef<HTMLDivElement>(null);

  // Load draft from navigation state (when coming from drafts list)
  const loadDraftFromNav = (location.state as { loadDraft?: Draft } | null)?.loadDraft;

  // Helper to load a draft into the composer
  const loadDraftIntoComposer = useCallback((draft: Draft) => {
    setCurrentDraftId(draft.id);
    setTitle(draft.title || "");
    setRecipientType(draft.recipientType);
    setRecipientEmail(draft.recipientEmail || "");
    setRecipientName((draft as any).recipientName || "");
    if (draft.deliveryDate) {
      setDeliveryDate(new Date(draft.deliveryDate));
    }
    setSignature(draft.signature || "");
    if (draft.signatureFont) {
      const found = SIGNATURE_FONTS.find(f => f.class === draft.signatureFont);
      if (found) setSignatureFont(found);
    }
    if (draft.paperColor) {
      const found = PAPER_COLORS.find(c => c.value === draft.paperColor);
      if (found) setPaperColor(found);
    }
    if (draft.inkColor) {
      const found = INK_COLORS.find(c => c.value === draft.inkColor);
      if (found) setInkColor(found);
    }
    setShowLines(draft.isLined ?? true);
    setInputMode(draft.isTyped ? "type" : "sketch");

    // Restore body pages
    if (draft.body) {
      const pages = draft.body.split("\n\n--- Page Break ---\n\n");
      setTextPages(pages.length > 0 ? pages : [""]);
    } else {
      setTextPages([""]);
    }

    // Restore sketch data — deserialize multi-page format back to per-page Stroke[] JSON
    if (draft.sketchData) {
      const pages = deserializeMultiPage(draft.sketchData);
      if (pages && pages.length > 0) {
        const sketchPagesData = pages.map(p => JSON.stringify(p.strokes));
        setSketchPages(sketchPagesData);
      } else {
        setSketchPages([""]);
      }
    } else {
      setSketchPages([""]);
    }

    // Clear localStorage draft since we're now working on a DB draft
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    // Clear navigation state
    window.history.replaceState({}, document.title);
  }, []);

  // Restore draft from localStorage or navigation state on mount
  useEffect(() => {
    if (loadDraftFromNav) {
      loadDraftIntoComposer(loadDraftFromNav);
    } else {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        try {
          const draft: LetterDraft = JSON.parse(savedDraft);
          setRecipientType(draft.recipientType);
          setRecipientEmail(draft.recipientEmail);
          setTitle(draft.title);
          if (draft.deliveryDate) {
            setDeliveryDate(new Date(draft.deliveryDate));
          }
          setSignature(draft.signature);
          setSignatureFont(draft.signatureFont);
          setInputMode(draft.inputMode);
          setShowLines(draft.showLines);
          setPaperColor(draft.paperColor);
          setInkColor(draft.inkColor);
          setSketchPages(draft.sketchPages?.length > 0 ? draft.sketchPages : [""]);
          setTextPages(draft.textPages.length > 0 ? draft.textPages : [""]);
        } catch (e) {
          console.error("Failed to restore draft:", e);
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
    }
    setDraftLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    const draft: LetterDraft = {
      recipientType,
      recipientEmail,
      recipientName,
      title,
      deliveryDate: deliveryDate?.toISOString() || null,
      signature,
      signatureFont,
      inputMode,
      showLines,
      paperColor,
      inkColor,
      textPages,
      sketchPages,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      // localStorage quota exceeded — clear old drafts and try once more
      console.warn("Draft save failed, clearing storage and retrying", e);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // Still too large — skip saving silently
        console.warn("Draft too large for localStorage, skipping save");
      }
    }
  }, [
    recipientType,
    recipientEmail,
    recipientName,
    title,
    deliveryDate,
    signature,
    signatureFont,
    inputMode,
    showLines,
    paperColor,
    inkColor,
    textPages,
    sketchPages,
  ]);

  // Auto-save draft to localStorage on every change
  useEffect(() => {
    if (!draftLoaded) return;
    saveDraft();
  }, [draftLoaded, saveDraft]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setCurrentDraftId(null);
  }, []);

  // Build a draft input object from current state
  const buildDraftInput = useCallback(() => ({
    id: currentDraftId || undefined,
    title: title || "Untitled Letter",
    body: getCombinedBody(),
    date: format(new Date(), "MMMM d, yyyy"),
    deliveryDate: deliveryDate?.toISOString(),
    signature,
    signatureFont: signatureFont.class,
    recipientEmail: recipientType === "someone" ? recipientEmail : undefined,
    recipientType,
    photos: [] as string[], // Photos are File objects, can't save to draft without uploading
    sketchData: getCombinedSketchData() || undefined,
    isTyped: inputMode === "type",
    paperColor: paperColor.value,
    inkColor: inkColor.value,
    isLined: showLines,
  }), [currentDraftId, title, deliveryDate, signature, signatureFont, recipientType, recipientEmail, inputMode, paperColor, inkColor, showLines, textPages, sketchPages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save draft to DB
  const handleSaveDraftToDb = useCallback(async (silent = false) => {
    if (!user) {
      // Not signed in — redirect to auth
      saveDraft(); // Save to localStorage first
      navigate("/auth", { state: { from: { pathname: "/write" } } });
      toast.info("Please sign in to save your draft");
      return;
    }

    try {
      const result = await saveDraftToDb(buildDraftInput());
      setCurrentDraftId(result.id);
      // Clear localStorage since it's now in DB
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      if (!silent) {
        toast.success("Draft saved");
      }
    } catch (error: any) {
      if (!silent) {
        toast.error("Failed to save draft: " + error.message);
      }
    }
  }, [user, saveDraftToDb, buildDraftInput, saveDraft, navigate]);

  // Auto-save to DB every 60 seconds if signed in
  useEffect(() => {
    if (!user || !draftLoaded) return;
    const interval = setInterval(() => {
      // Only auto-save if there's content
      const hasContent = title.trim() || textPages.some(p => p.trim()) || sketchPages.some(p => p && p !== "" && p !== "[]");
      if (hasContent) {
        handleSaveDraftToDb(true);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, draftLoaded, handleSaveDraftToDb, title, textPages, sketchPages]);

  const handleLetterWheelCapture = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = letterScrollRef.current;
    if (!el) return;

    // If the letter panel can scroll in the wheel direction, prevent the page from scrolling.
    const deltaY = e.deltaY;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

    const scrollingDown = deltaY > 0;
    const scrollingUp = deltaY < 0;

    const canScrollDown = !atBottom;
    const canScrollUp = !atTop;

    if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) {
      e.stopPropagation();
    }
  }, []);

  // Helper to update a specific text page
  const updateTextPage = useCallback((pageIndex: number, newBody: string) => {
    setTextPages((prev) => prev.map((page, idx) => (idx === pageIndex ? newBody : page)));
  }, []);

  // Helper to update a specific sketch page
  const updateSketchPage = useCallback((pageIndex: number, newSketch: string) => {
    setSketchPages((prev) => prev.map((page, idx) => (idx === pageIndex ? newSketch : page)));
  }, []);

  // Add a new page to the current mode only
  const addNewPage = useCallback(() => {
    if (inputMode === "type") {
      setTextPages((prev) => [...prev, ""]);
    } else {
      setSketchPages((prev) => [...prev, ""]);
    }

    // IMPORTANT: Only scroll the letter container (not the entire window)
    setTimeout(() => {
      const el = letterScrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 0);
  }, [inputMode]);

  // Delete a page if it's empty (and not the only page)
  const deletePage = useCallback(
    (pageIndex: number) => {
      if (inputMode === "type") {
        if (textPages.length > 1 && textPages[pageIndex].trim() === "") {
          setTextPages((prev) => prev.filter((_, idx) => idx !== pageIndex));
        }
      } else {
        if (sketchPages.length > 1 && (sketchPages[pageIndex] === "" || sketchPages[pageIndex] === "[]")) {
          // Also clear the ref
          sketchCanvasRefs.current.delete(pageIndex);
          setSketchPages((prev) => prev.filter((_, idx) => idx !== pageIndex));
        }
      }
    },
    [inputMode, textPages, sketchPages],
  );

  // Check if a page is empty
  const isPageEmpty = useCallback(
    (pageIndex: number) => {
      if (inputMode === "type") {
        return textPages[pageIndex]?.trim() === "";
      } else {
        const content = sketchPages[pageIndex];
        return !content || content === "" || content === "[]";
      }
    },
    [inputMode, textPages, sketchPages],
  );

  // Get the pages for the current mode
  const currentPages = inputMode === "type" ? textPages : sketchPages;

  // Get combined content for saving
  const getCombinedBody = () => textPages.join("\n\n--- Page Break ---\n\n");

  // Combine all sketch pages into compact flat array format
  // Uses sketchPages state directly (not refs) to work even when sketch mode is not active
  const getCombinedSketchData = () => {
    const allPagesData: { pageIndex: number; strokes: import("@/components/sketch/FreehandCanvas").Stroke[] }[] = [];

    for (let i = 0; i < sketchPages.length; i++) {
      const pageData = sketchPages[i];
      if (pageData && pageData !== "" && pageData !== "[]") {
        try {
          const strokes = JSON.parse(pageData);
          if (Array.isArray(strokes) && strokes.length > 0) {
            allPagesData.push({ pageIndex: i, strokes });
          }
        } catch {
          // Skip invalid data
        }
      }
    }

    // Use compact flat array serialization
    return serializeMultiPage(allPagesData);
  };

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
  const MAX_IMAGE_SIZE_MB = 5;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 3) {
      toast.error("You can only attach up to 3 photos");
      // Reset input so same file can be re-selected
      e.target.value = "";
      return;
    }

    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" is not a supported format. Please use JPG, PNG, GIF, or WebP.`);
        e.target.value = "";
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" is too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`);
        e.target.value = "";
        return;
      }
      validFiles.push(file);
    }

    const newUrls = validFiles.map((file) => URL.createObjectURL(file));
    setPhotos((prev) => [...prev, ...validFiles]);
    setPhotoPreviewUrls((prev) => [...prev, ...newUrls]);

    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setDatePreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case "today":
        setDeliveryDate(now);
        break;
      case "1month":
        setDeliveryDate(addMonths(now, 1));
        break;
      case "1year":
        setDeliveryDate(addYears(now, 1));
        break;
      case "5years":
        setDeliveryDate(addYears(now, 5));
        break;
      case "10years":
        setDeliveryDate(addYears(now, 10));
        break;
    }
  };

  const handleSealLetter = () => {
    // Check auth first if enabled
    if (FEATURE_FLAGS.AUTH_ENABLED && !user) {
      // Save draft before redirecting
      saveDraft();
      // Redirect to auth with return path
      navigate("/auth", { state: { from: { pathname: "/write" } } });
      toast.info("Please sign in to seal");
      return;
    }

    // Check encryption readiness only for "myself" letters
    if (recipientType === "myself" && !isEncryptionReady) {
      if (encryptionError) {
        toast.error(encryptionError);
      } else {
        toast.error("Secure storage is still initializing. Please wait a moment.");
      }
      return;
    }

    if (!title.trim()) {
      toast.error("Please add a title");
      return;
    }

    const currentBody = getCombinedBody();
    if (inputMode === "type" && !currentBody.trim()) {
      toast.error("Please write something for the future");
      return;
    }

    if (!deliveryDate) {
      toast.error("Please select a delivery date");
      return;
    }

    if (recipientType === "someone" && !recipientEmail.trim()) {
      toast.error("Please enter the recipient's email");
      return;
    }

    if (recipientType === "someone" && !recipientName.trim()) {
      toast.error("Please enter the recipient's name");
      return;
    }

    if (!signature.trim()) {
      toast.error("Please add your signature");
      return;
    }

    // Start sealing animation
    setIsSealing(true);
  };

  const completeSeal = async () => {
    // Get sketch data from state (works regardless of current mode)
    const finalSketchData = getCombinedSketchData();
    const hasSketchContent = finalSketchData && finalSketchData !== "[]" && finalSketchData.length > 0;
    const textBody = getCombinedBody();
    const hasTextContent = textBody.trim().length > 0;

    try {
      // Upload photos to cloud storage
      let photoUrls: string[] = [];
      if (photos.length > 0 && user) {
        toast.info("Uploading photos...");
        photoUrls = await uploadPhotosToStorage(photos, user.id);
      }

      const savedLetter = await addLetter({
        title,
        body: textBody,
        date: format(new Date(), "MMMM d, yyyy"),
        deliveryDate: deliveryDate!.toISOString(),
        signature,
        signatureFont: signatureFont.class,
        recipientEmail: recipientType === "someone" ? recipientEmail : undefined,
        recipientName: recipientType === "someone" ? recipientName : undefined,
        recipientType,
        photos: photoUrls,
        sketchData: hasSketchContent ? finalSketchData : undefined,
        isTyped: hasTextContent,
        type: "sent" as const,
        paperColor: paperColor.value,
        inkColor: inkColor.value,
        isLined: showLines,
        draftId: currentDraftId || undefined,
      });

      // Clear any saved draft on success
      clearDraft();

      // Navigate with the new letter ID so Vault can wait for it to be available
      setTimeout(() => {
        navigate("/vault", { state: { newLetterId: savedLetter.id } });
      }, 500);
    } catch (error) {
      setIsSealing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden select-none">
      {/* Paper texture overlay */}
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      {/* Sealing Animation Overlay */}
      <AnimatePresence>
        {isSealing && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {/* Sealing envelope animation */}
              <motion.div
                className="relative"
                initial={{ y: 0 }}
                animate={{ y: [-20, 0] }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <svg viewBox="0 0 160 120" className="w-64 h-48">
                  {/* Envelope body */}
                  <rect
                    x="10"
                    y="35"
                    width="140"
                    height="80"
                    rx="6"
                    fill="hsl(var(--envelope-cream))"
                    stroke="hsl(var(--border))"
                    strokeWidth="1.5"
                  />

                  {/* Envelope flap - animates closed */}
                  <motion.path
                    d="M 10 35 L 80 75 L 150 35"
                    fill="hsl(var(--cream))"
                    stroke="hsl(var(--border))"
                    strokeWidth="1.5"
                    initial={{ rotateX: 180, originY: "35px" }}
                    animate={{ rotateX: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    style={{ transformOrigin: "center 35px" }}
                  />

                  {/* Wax seal appears - use absolute positioning instead of transform */}
                  <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.4 }}>
                    <motion.circle
                      cx="80"
                      cy="65"
                      r="16"
                      fill="hsl(var(--seal-maroon))"
                      initial={{ r: 0 }}
                      animate={{ r: 16 }}
                      transition={{ delay: 1, duration: 0.4, type: "spring" }}
                    />
                    <motion.line
                      x1="73"
                      y1="65"
                      x2="84"
                      y2="65"
                      stroke="hsl(var(--primary-foreground))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 }}
                    />
                    <motion.circle
                      cx="88"
                      cy="65"
                      r="2.5"
                      fill="hsl(var(--primary-foreground))"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 }}
                    />
                  </motion.g>
                </svg>
              </motion.div>

              <motion.p
                className="text-primary-foreground font-editorial text-2xl mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
              >
                Your entry is sealed
              </motion.p>

              <motion.p
                className="text-primary-foreground/70 text-sm mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                onAnimationComplete={completeSeal}
              >
                Safe until {deliveryDate ? format(deliveryDate, "MMMM d, yyyy") : "..."}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <AnimatePresence>
            {recipientType === "someone" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-accent text-accent-foreground text-sm font-medium px-3 py-1.5 rounded-full border border-border shadow-sm"
              >
                In beta testing
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">Write now, open later</h1>
            <p className="text-muted-foreground font-body">Take your time. Make it meaningful.</p>
          </div>

          {/* Draft Banner */}
          {user && drafts.length > 0 && !draftBannerDismissed && !currentDraftId && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 bg-card/80 rounded-xl border border-border/50 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground font-body">
                  You have {drafts.length} saved draft{drafts.length > 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => setShowDraftsModal(true)}
                  className="text-sm text-primary hover:text-primary/80 font-body underline-offset-2 hover:underline"
                >
                  Continue writing →
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDraftBannerDismissed(true)}
                className="h-8 w-8 rounded-full text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Recipient Toggle */}
          <div className="flex justify-center gap-3 mb-8 relative">
            <Button
              variant={recipientType === "myself" ? "default" : "outline"}
              onClick={() => setRecipientType("myself")}
              className="rounded-full px-6"
            >
              To Myself
            </Button>
            <div className="relative">
              <Button
                variant={recipientType === "someone" ? "default" : "outline"}
                onClick={() => setRecipientType("someone")}
                className="rounded-full px-6"
              >
                To Someone Else
              </Button>
            </div>
          </div>

          {/* Input Mode Toggle */}
          <div className="flex justify-center gap-3 mb-8">
            <Button
              variant={inputMode === "type" ? "default" : "outline"}
              onClick={() => {
                // Before switching to type mode, capture all current sketch data from refs
                // This ensures any pending strokes are saved before unmounting
                if (inputMode === "sketch") {
                  sketchCanvasRefs.current.forEach((ref, pageIndex) => {
                    if (ref) {
                      ref.getDataUrl().then((data) => {
                        if (data && data !== "[]") {
                          updateSketchPage(pageIndex, data);
                        }
                      });
                    }
                  });
                }
                setInputMode("type");
              }}
              className="rounded-full px-6"
            >
              <Type className="w-4 h-4 mr-2" />
              Typed
            </Button>
            <Button
              variant={inputMode === "sketch" ? "default" : "outline"}
              onClick={() => setInputMode("sketch")}
              className="rounded-full px-6"
            >
              <PenTool className="w-4 h-4 mr-2" />
              Sketched
            </Button>
          </div>

          {/* Customization Options */}
          <div className="flex flex-wrap justify-center gap-6 mb-8 p-4 bg-card/50 rounded-2xl border border-border/50">
            {/* Paper Color */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Paper:</span>
              <div className="flex gap-1">
                {PAPER_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setPaperColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      paperColor.name === color.name ? "border-primary scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Ink Color */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ink:</span>
              <div className="flex gap-1">
                {INK_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setInkColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      inkColor.name === color.name ? "border-primary scale-110" : "border-border"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Lines Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Lines:</span>
              <button
                onClick={() => setShowLines(!showLines)}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                  showLines ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                {showLines && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Letter Writing Area - Continuous Scroll */}
          <div
            ref={letterScrollRef}
            onWheelCapture={handleLetterWheelCapture}
            className="rounded-2xl shadow-dreamy mb-8 border border-border/50 transition-colors max-h-[85vh] overflow-y-auto overscroll-contain"
            style={{ backgroundColor: paperColor.value }}
          >
            <div className="p-6 md:p-8">
              {/* Title Input */}
              <Input
                placeholder="Title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl font-editorial border-0 border-b border-border/50 rounded-none px-0 mb-6 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/50"
                style={{ color: inkColor.value }}
              />

              {/* All Pages - Continuous Scroll */}
              <div className="space-y-8">
                {inputMode === "type"
                  ? // Text mode pages
                    textPages.map((pageContent, pageIndex) => (
                      <div key={`text-${pageIndex}`} className="relative">
                        {/* Page header with delete button */}
                        {textPages.length > 1 && (
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground/60 font-body">Page {pageIndex + 1}</span>
                            {isPageEmpty(pageIndex) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deletePage(pageIndex)}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            )}
                          </div>
                        )}

                        <Textarea
                          placeholder={pageIndex === 0 ? "Start writing..." : "Continue writing..."}
                          value={pageContent}
                          onChange={(e) => updateTextPage(pageIndex, e.target.value)}
                          className={`min-h-[400px] resize-none border-0 px-0 focus-visible:ring-0 bg-transparent font-body text-lg placeholder:text-muted-foreground/50 ${
                            showLines ? "lined-paper" : ""
                          }`}
                          style={{ color: inkColor.value }}
                        />

                        {/* Page divider */}
                        {pageIndex < textPages.length - 1 && (
                          <div className="border-b border-dashed border-border/40 mt-6" />
                        )}
                      </div>
                    ))
                  : // Sketch mode pages - use stable keys that don't cause remounting
                    sketchPages.map((pageContent, pageIndex) => (
                      <div key={`sketch-page-${pageIndex}`} className="relative">
                        {/* Page header with delete button */}
                        {sketchPages.length > 1 && (
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground/60 font-body">Page {pageIndex + 1}</span>
                            {isPageEmpty(pageIndex) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deletePage(pageIndex)}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            )}
                          </div>
                        )}

                        <SketchCanvas
                          ref={(ref) => {
                            if (ref) {
                              sketchCanvasRefs.current.set(pageIndex, ref);
                            } else {
                              sketchCanvasRefs.current.delete(pageIndex);
                            }
                          }}
                          canvasId={`sketch-page-${pageIndex}`}
                          onChange={(data) => updateSketchPage(pageIndex, data)}
                          inkColor={inkColor.value}
                          showLines={showLines}
                          initialData={pageContent}
                        />

                        {/* Page divider */}
                        {pageIndex < sketchPages.length - 1 && (
                          <div className="border-b border-dashed border-border/40 mt-6" />
                        )}
                      </div>
                    ))}
              </div>

              {/* Add Page button */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30 select-none">
                <span className="text-sm text-muted-foreground font-body">
                  {currentPages.length} {currentPages.length === 1 ? "page" : "pages"}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addNewPage} className="rounded-full">
                  <Plus className="w-4 h-4 mr-1" />
                  Add New Page
                </Button>
              </div>
            </div>
          </div>

          {/* Photo Attachments */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-3 block font-body">
              Photo Attachments (max 3)
            </label>
            <div className="flex gap-3 flex-wrap">
              {photoPreviewUrls.map((previewUrl, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img
                    src={previewUrl}
                    alt={`Attachment ${index + 1}`}
                    className="w-full h-full object-cover rounded-xl border-2 border-border shadow-editorial"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-card text-foreground rounded-full flex items-center justify-center shadow-editorial border border-border"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors bg-card/50"
                >
                  <Image className="w-6 h-6" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Delivery Date */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-3 block font-body">Delivery Date</label>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                // Only show "Today" option when bypass is enabled (for testing)
                ...(FEATURE_FLAGS.BYPASS_DELIVERY_DATE ? [{ label: "Today", value: "today" }] : []),
                { label: "1 month", value: "1month" },
                { label: "1 year", value: "1year" },
                { label: "5 years", value: "5years" },
                { label: "10 years", value: "10years" },
              ].map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  size="sm"
                  onClick={() => setDatePreset(preset.value)}
                  className="rounded-full"
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left rounded-xl bg-card/50">
                  <Calendar className="w-4 h-4 mr-2" />
                  {deliveryDate ? format(deliveryDate, "MMMM d, yyyy") : "Or choose a custom date..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={deliveryDate}
                  onSelect={setDeliveryDate}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const compareDate = new Date(date);
                    compareDate.setHours(0, 0, 0, 0);
                    const maxDate = addYears(today, 20);
                    // When bypass is disabled, don't allow selecting today
                    const minDate = FEATURE_FLAGS.BYPASS_DELIVERY_DATE ? today : addDays(today, 1);
                    return compareDate < minDate || compareDate > maxDate;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {deliveryDate && (
              <p className="text-sm text-muted-foreground mt-2 font-body">
                Written on {format(new Date(), "MMMM d, yyyy")} • Arrives {format(deliveryDate, "MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Recipient Email */}
          {recipientType === "someone" && (
            <div className="mb-8 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block font-body">Recipient Name</label>
                <Input
                  type="text"
                  placeholder="Their name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="bg-card/50 rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block font-body">Recipient Email</label>
                <Input
                  type="email"
                  placeholder="their.email@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="bg-card/50 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* Signature */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-3 block font-body">Your Signature</label>

            {/* Signature font options */}
            <div className="flex gap-2 mb-3">
              {SIGNATURE_FONTS.map((font) => (
                <Button
                  key={font.name}
                  variant={signatureFont.name === font.name ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSignatureFont(font)}
                  className={`rounded-full ${font.class}`}
                >
                  {font.name}
                </Button>
              ))}
            </div>

            <Input
              placeholder="Signed..."
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className={`bg-card/50 rounded-xl text-lg ${signatureFont.class}`}
            />

            {signature && (
              <p className={`mt-3 text-2xl ${signatureFont.class}`} style={{ color: inkColor.value }}>
                {signature}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => handleSaveDraftToDb(false)}
              disabled={isSavingDraft}
              variant="outline"
              size="lg"
              className="flex-1 text-lg py-6 rounded-full"
            >
              <Save className="w-5 h-5 mr-2" />
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={handleSealLetter}
              disabled={recipientType === "myself" && isEncryptionInitializing}
              size="lg"
              className="flex-[2] text-lg py-6 rounded-full shadow-dreamy bg-primary hover:bg-primary/90"
            >
              {recipientType === "myself" && isEncryptionInitializing ? "Securing your entry..." : "Seal"}
            </Button>
          </div>
          {encryptionError && recipientType === "myself" && (
            <p className="text-center text-destructive text-sm mt-2 font-body">{encryptionError}</p>
          )}

          <p className="text-center text-muted-foreground text-sm mt-4 font-body italic">
            Once sealed, this cannot be viewed, edited, or rewritten until delivery.
          </p>
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

      {/* Drafts Modal */}
      <AnimatePresence>
        {showDraftsModal && (
          <DraftsList
            onLoadDraft={(draft) => {
              loadDraftIntoComposer(draft);
              setShowDraftsModal(false);
            }}
            onClose={() => setShowDraftsModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WriteLetter;
