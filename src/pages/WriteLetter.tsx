import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Image, Mic, PenTool, Type, X } from "lucide-react";
import Logo from "@/components/Logo";
import SketchCanvas from "@/components/SketchCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useLetterStore } from "@/stores/letterStore";
import { toast } from "sonner";

const WriteLetter = () => {
  const navigate = useNavigate();
  const addLetter = useLetterStore((state) => state.addLetter);
  
  const [recipientType, setRecipientType] = useState<"myself" | "someone">("myself");
  const [inputMode, setInputMode] = useState<"type" | "sketch">("type");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sketchData, setSketchData] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [signature, setSignature] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const letterTitle = recipientType === "myself" ? "A letter to myself" : "A letter to someone special";

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

  const handleSealLetter = () => {
    if (!title.trim()) {
      toast.error("Please add a title to your letter");
      return;
    }
    
    if (inputMode === "type" && !body.trim()) {
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

    const newLetter = {
      id: crypto.randomUUID(),
      title,
      body,
      date: format(new Date(), "MMMM d, yyyy"),
      deliveryDate: deliveryDate.toISOString(),
      signature,
      recipientEmail: recipientType === "someone" ? recipientEmail : undefined,
      recipientType,
      photos,
      sketchData: inputMode === "sketch" ? sketchData : undefined,
      isTyped: inputMode === "type",
      createdAt: new Date().toISOString(),
      type: "sent" as const,
    };

    addLetter(newLetter);
    toast.success("Your letter has been sealed and saved to the vault!");
    navigate("/vault");
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
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Letter Title */}
          <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
            {letterTitle}
          </h1>

          {/* Recipient Toggle */}
          <div className="flex gap-3 mb-6">
            <Button
              variant={recipientType === "myself" ? "default" : "outline"}
              onClick={() => setRecipientType("myself")}
            >
              To myself
            </Button>
            <Button
              variant={recipientType === "someone" ? "default" : "outline"}
              onClick={() => setRecipientType("someone")}
            >
              To someone else
            </Button>
          </div>

          {/* Input Mode Toggle */}
          <div className="flex gap-3 mb-8">
            <Button
              variant={inputMode === "type" ? "default" : "outline"}
              onClick={() => setInputMode("type")}
            >
              <Type className="w-4 h-4 mr-2" />
              Type
            </Button>
            <Button
              variant={inputMode === "sketch" ? "default" : "outline"}
              onClick={() => setInputMode("sketch")}
            >
              <PenTool className="w-4 h-4 mr-2" />
              Sketch
            </Button>
          </div>

          {/* Letter Writing Area */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-envelope mb-8">
            {/* Title Input */}
            <Input
              placeholder="Letter title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-serif border-0 border-b border-border rounded-none px-0 mb-4 focus-visible:ring-0"
            />

            {/* Content Area */}
            {inputMode === "type" ? (
              <div className="relative">
                <Textarea
                  placeholder="Dear future me..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[300px] resize-none border-0 px-0 focus-visible:ring-0 paper-texture"
                />
                <button 
                  className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="Voice to text"
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <SketchCanvas onChange={setSketchData} />
            )}
          </div>

          {/* Photo Attachments */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-3 block">
              Photo Attachments (max 3)
            </label>
            <div className="flex gap-3 flex-wrap">
              {photos.map((photo, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img
                    src={photo}
                    alt={`Attachment ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
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

          {/* Letter Settings */}
          <div className="space-y-6 mb-8">
            {/* Delivery Date */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Delivery Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <Calendar className="w-4 h-4 mr-2" />
                    {deliveryDate ? format(deliveryDate, "MMMM d, yyyy") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={deliveryDate}
                    onSelect={setDeliveryDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Recipient Email */}
            {recipientType === "someone" && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Recipient Email
                </label>
                <Input
                  type="email"
                  placeholder="their.email@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            )}

            {/* Signature */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Your Signature
              </label>
              <Input
                placeholder="With love..."
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="font-serif italic"
              />
            </div>
          </div>

          {/* Seal Button */}
          <Button 
            onClick={handleSealLetter}
            size="lg" 
            className="w-full text-lg py-6"
          >
            Seal Your Letter
          </Button>
          
          <p className="text-center text-muted-foreground text-sm mt-4">
            Once sealed, this letter will be tucked away until the delivery date.
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default WriteLetter;
