import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Image, PenTool, Type, X, Check, Instagram, Plus } from "lucide-react";
import SketchCanvas, { SketchCanvasRef } from "@/components/SketchCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addMonths, addYears } from "date-fns";
import { useLetters } from "@/hooks/useLetters";
import { toast } from "sonner";

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

// TikTok Icon
const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const WriteLetter = () => {
  const navigate = useNavigate();
  const { addLetter, isAddingLetter } = useLetters();
  
  const [recipientType, setRecipientType] = useState<"myself" | "someone">("myself");
  const [inputMode, setInputMode] = useState<"type" | "sketch">("type");
  const [title, setTitle] = useState("");
  // Multi-page support: array of page content
  const [pages, setPages] = useState<Array<{ body: string; sketchData: string }>>([{ body: "", sketchData: "" }]);
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [signature, setSignature] = useState("");
  const [signatureFont, setSignatureFont] = useState(SIGNATURE_FONTS[0]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [paperColor, setPaperColor] = useState(PAPER_COLORS[0]);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [showLines, setShowLines] = useState(true);
  const [isSealing, setIsSealing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sketchCanvasRefs = useRef<Map<number, SketchCanvasRef>>(new Map());
  const letterScrollRef = useRef<HTMLDivElement>(null);

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

  // Helper to update a specific page's body
  const updatePageBody = useCallback((pageIndex: number, newBody: string) => {
    setPages(prev => prev.map((page, idx) => 
      idx === pageIndex ? { ...page, body: newBody } : page
    ));
  }, []);

  // Helper to update a specific page's sketch
  const updatePageSketch = useCallback((pageIndex: number, newSketch: string) => {
    setPages(prev => prev.map((page, idx) => 
      idx === pageIndex ? { ...page, sketchData: newSketch } : page
    ));
  }, []);

  // Add a new page and scroll to it
  const addNewPage = useCallback(() => {
    setPages(prev => [...prev, { body: "", sketchData: "" }]);

    // IMPORTANT: Only scroll the letter container (not the entire window)
    // after the new page mounts.
    setTimeout(() => {
      const el = letterScrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 0);
  }, []);

  // Get combined content for saving
  const getCombinedBody = () => pages.map(p => p.body).join("\n\n--- Page Break ---\n\n");
  const getCombinedSketch = () => pages[0]?.sketchData || ""; // For now, use first page sketch

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 3) {
      toast.error("You can only attach up to 3 photos");
      return;
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const setDatePreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
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
    if (!title.trim()) {
      toast.error("Please add a title to your letter");
      return;
    }
    
    const currentBody = getCombinedBody();
    if (inputMode === "type" && !currentBody.trim()) {
      toast.error("Please write something in your letter");
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
    
    if (!signature.trim()) {
      toast.error("Please add your signature");
      return;
    }

    // Start sealing animation
    setIsSealing(true);
  };

  const completeSeal = async () => {
    // Get final sketch data from all pages if in sketch mode
    let finalSketchData = getCombinedSketch();
    if (inputMode === "sketch") {
      const firstRef = sketchCanvasRefs.current.get(0);
      if (firstRef) {
        finalSketchData = firstRef.getDataUrl();
      }
    }
    
    try {
      await addLetter({
        title,
        body: getCombinedBody(),
        date: format(new Date(), "MMMM d, yyyy"),
        deliveryDate: deliveryDate!.toISOString(),
        signature,
        signatureFont: signatureFont.class,
        recipientEmail: recipientType === "someone" ? recipientEmail : undefined,
        recipientType,
        photos,
        sketchData: inputMode === "sketch" ? finalSketchData : undefined,
        isTyped: inputMode === "type",
        type: "sent" as const,
        paperColor: paperColor.value,
        inkColor: inkColor.value,
      });
      
      setTimeout(() => {
        navigate("/vault");
      }, 500);
    } catch (error) {
      setIsSealing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-editorial relative overflow-hidden">
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
                  
                  {/* Wax seal appears */}
                  <motion.g 
                    transform="translate(80, 65)"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1, duration: 0.4, type: "spring" }}
                  >
                    <circle 
                      cx="0" 
                      cy="0" 
                      r="16" 
                      className="wax-seal"
                      fill="hsl(var(--seal-maroon))"
                    />
                    <line
                      x1="-7"
                      y1="0"
                      x2="4"
                      y2="0"
                      stroke="hsl(var(--primary-foreground))"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="8"
                      cy="0"
                      r="2.5"
                      fill="hsl(var(--primary-foreground))"
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
                Your letter is sealed
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
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-body">Back</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">
              Write a Letter
            </h1>
            <p className="text-muted-foreground font-body">Take your time. Make it meaningful.</p>
          </div>

          {/* Recipient Toggle */}
          <div className="flex justify-center gap-3 mb-8">
            <Button
              variant={recipientType === "myself" ? "default" : "outline"}
              onClick={() => setRecipientType("myself")}
              className="rounded-full px-6"
            >
              To Myself
            </Button>
            <Button
              variant={recipientType === "someone" ? "default" : "outline"}
              onClick={() => setRecipientType("someone")}
              className="rounded-full px-6"
            >
              To Someone Else
            </Button>
          </div>

          {/* Input Mode Toggle */}
          <div className="flex justify-center gap-3 mb-8">
            <Button
              variant={inputMode === "type" ? "default" : "outline"}
              onClick={() => setInputMode("type")}
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
            className="rounded-2xl shadow-dreamy mb-8 border border-border/50 transition-colors max-h-[80vh] overflow-y-auto overscroll-contain"
            style={{ backgroundColor: paperColor.value }}
          >
            <div className="p-6 md:p-8">
              {/* Title Input */}
              <Input
                placeholder="Letter title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl font-editorial border-0 border-b border-border/50 rounded-none px-0 mb-6 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/50"
                style={{ color: inkColor.value }}
              />

              {/* All Pages - Continuous Scroll */}
              <div className="space-y-8">
                {pages.map((page, pageIndex) => (
                  <div key={pageIndex} className="relative">
                    {/* Page header */}
                    {pages.length > 1 && (
                      <div className="text-xs text-muted-foreground/60 mb-2 font-body">
                        Page {pageIndex + 1}
                      </div>
                    )}
                    
                    {/* Content Area */}
                    {inputMode === "type" ? (
                      <Textarea
                        placeholder={pageIndex === 0 ? "Dear future me..." : "Continue writing..."}
                        value={page.body}
                        onChange={(e) => updatePageBody(pageIndex, e.target.value)}
                        className={`min-h-[400px] resize-none border-0 px-0 focus-visible:ring-0 bg-transparent font-body text-lg placeholder:text-muted-foreground/50 ${
                          showLines ? "lined-paper" : ""
                        }`}
                        style={{ color: inkColor.value }}
                      />
                    ) : (
                      <SketchCanvas 
                        ref={(ref) => {
                          if (ref) {
                            sketchCanvasRefs.current.set(pageIndex, ref);
                          } else {
                            sketchCanvasRefs.current.delete(pageIndex);
                          }
                        }}
                        onChange={(data) => updatePageSketch(pageIndex, data)}
                        inkColor={inkColor.value}
                        showLines={showLines}
                        initialData={page.sketchData}
                      />
                    )}
                    
                    {/* Page divider */}
                    {pageIndex < pages.length - 1 && (
                      <div className="border-b border-dashed border-border/40 mt-6" />
                    )}
                  </div>
                ))}
              </div>

              {/* Add Page button */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
                <span className="text-sm text-muted-foreground font-body">
                  {pages.length} {pages.length === 1 ? "page" : "pages"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addNewPage}
                  className="rounded-full"
                >
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
              {photos.map((photo, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img
                    src={photo}
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
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Delivery Date */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-3 block font-body">
              Delivery Date
            </label>
            
            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
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
                    const now = new Date();
                    const maxDate = addYears(now, 20);
                    return date < now || date > maxDate;
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
            <div className="mb-8">
              <label className="text-sm font-medium text-foreground mb-2 block font-body">
                Recipient Email
              </label>
              <Input
                type="email"
                placeholder="their.email@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="bg-card/50 rounded-xl"
              />
            </div>
          )}

          {/* Signature */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-3 block font-body">
              Your Signature
            </label>
            
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
              placeholder="With love..."
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

          {/* Seal Button */}
          <Button 
            onClick={handleSealLetter}
            size="lg" 
            className="w-full text-lg py-6 rounded-full shadow-dreamy bg-primary hover:bg-primary/90"
          >
            Seal
          </Button>
          
          <p className="text-center text-muted-foreground text-sm mt-4 font-body italic">
            Once sealed, this letter cannot be viewed, edited, or rewritten until delivery.
          </p>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-16 border-t border-border/50 bg-card/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-6">
            <a
              href="https://www.instagram.com/signed.app"
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
      </footer>
    </div>
  );
};

export default WriteLetter;
