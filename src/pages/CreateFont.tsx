import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomFont, GlyphRecord } from "@/hooks/useCustomFont";
import { toast } from "sonner";
import GlyphCell from "@/components/GlyphCell";
import type { Stroke } from "@/components/sketch/FreehandCanvas";

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");
const PUNCTUATION = ".,!?;:'\"()-".split("");

const ALL_CHARS = [...UPPERCASE, ...LOWERCASE, ...DIGITS, ...PUNCTUATION];

function charLabel(c: string) {
  if (c === " ") return "space";
  if (c === ".") return "period";
  if (c === ",") return "comma";
  if (c === "!") return "!";
  if (c === "?") return "?";
  if (c === ";") return ";";
  if (c === ":") return ":";
  if (c === "'") return "'";
  if (c === '"') return '"';
  if (c === "(") return "(";
  if (c === ")") return ")";
  if (c === "-") return "-";
  return c;
}

const CreateFont = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { glyphMap, saveGlyphs, deleteAllGlyphs, isLoading } = useCustomFont();

  // Local state: character -> Stroke[] (live drawing data)
  const strokesRef = useRef<Map<string, Stroke[]>>(new Map());
  const [drawnCount, setDrawnCount] = useState(0);

  // Initialize from saved glyphs
  useEffect(() => {
    if (glyphMap.size > 0) {
      let count = 0;
      glyphMap.forEach((data, char) => {
        try {
          const strokes = JSON.parse(data) as Stroke[];
          if (strokes.length > 0) {
            strokesRef.current.set(char, strokes);
            count++;
          }
        } catch { /* ignore */ }
      });
      setDrawnCount(count);
    }
  }, [glyphMap]);

  const handleStrokesChange = useCallback((character: string, strokes: Stroke[]) => {
    if (strokes.length > 0) {
      strokesRef.current.set(character, strokes);
    } else {
      strokesRef.current.delete(character);
    }
    setDrawnCount(strokesRef.current.size);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to save your font");
      return;
    }
    const entries: GlyphRecord[] = [];
    strokesRef.current.forEach((strokes, char) => {
      if (strokes.length > 0) {
        entries.push({ character: char, stroke_data: JSON.stringify(strokes) });
      }
    });
    if (entries.length === 0) {
      toast.error("Draw at least one character first");
      return;
    }
    try {
      await saveGlyphs.mutateAsync(entries);
      toast.success(`Saved ${entries.length} characters!`);
    } catch (e: any) {
      toast.error("Failed to save: " + (e.message || "Unknown error"));
    }
  }, [user, saveGlyphs]);

  const handleDelete = useCallback(async () => {
    await deleteAllGlyphs();
    strokesRef.current.clear();
    setDrawnCount(0);
    toast.success("Font deleted");
  }, [deleteAllGlyphs]);

  const progress = Math.round((drawnCount / ALL_CHARS.length) * 100);

  const getInitialStrokes = useCallback(
    (char: string): Stroke[] | undefined => {
      const data = glyphMap.get(char);
      if (!data) return undefined;
      try {
        const strokes = JSON.parse(data) as Stroke[];
        return strokes.length > 0 ? strokes : undefined;
      } catch {
        return undefined;
      }
    },
    [glyphMap],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-editorial">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-editorial">
      <div className="absolute inset-0 paper-texture pointer-events-none" />

      <header className="container mx-auto px-4 py-6 relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-body">Back</span>
        </button>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-5xl relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <h1 className="font-editorial text-3xl md:text-4xl text-foreground mb-2">Create Your Font</h1>
            <p className="text-muted-foreground font-body">
              Draw each character to create your personal handwriting font
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8 max-w-md mx-auto">
            <div className="flex justify-between text-sm text-muted-foreground mb-2 font-body">
              <span>{drawnCount} of {ALL_CHARS.length} characters</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-3 mb-8">
            <Button onClick={handleSave} disabled={saveGlyphs.isPending || drawnCount === 0} className="rounded-full">
              <Save className="w-4 h-4 mr-2" />
              {saveGlyphs.isPending ? "Saving..." : "Save Font"}
            </Button>
            {drawnCount > 0 && (
              <Button variant="outline" onClick={handleDelete} className="rounded-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>

          {/* Character Sections */}
          <Section title="Uppercase" chars={UPPERCASE} getInitialStrokes={getInitialStrokes} onChange={handleStrokesChange} />
          <Section title="Lowercase" chars={LOWERCASE} getInitialStrokes={getInitialStrokes} onChange={handleStrokesChange} />
          <Section title="Numbers" chars={DIGITS} getInitialStrokes={getInitialStrokes} onChange={handleStrokesChange} />
          <Section title="Punctuation" chars={PUNCTUATION} getInitialStrokes={getInitialStrokes} onChange={handleStrokesChange} />
        </motion.div>
      </main>
    </div>
  );
};

interface SectionProps {
  title: string;
  chars: string[];
  getInitialStrokes: (char: string) => Stroke[] | undefined;
  onChange: (character: string, strokes: Stroke[]) => void;
}

const Section = ({ title, chars, getInitialStrokes, onChange }: SectionProps) => (
  <div className="mb-10">
    <h2 className="font-editorial text-lg text-foreground mb-4 border-b border-border/50 pb-2">{title}</h2>
    <div className="flex flex-wrap gap-3">
      {chars.map((c) => (
        <GlyphCell
          key={c}
          character={c}
          label={charLabel(c)}
          initialStrokes={getInitialStrokes(c)}
          onStrokesChange={onChange}
        />
      ))}
    </div>
  </div>
);

export default CreateFont;
