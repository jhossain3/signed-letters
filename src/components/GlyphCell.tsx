import { useRef, useState, useCallback, memo } from "react";
import { FreehandCanvas, FreehandCanvasRef, Stroke } from "./sketch";
import { Undo2, Trash2 } from "lucide-react";

interface GlyphCellProps {
  character: string;
  label: string;
  initialStrokes?: Stroke[];
  onStrokesChange: (character: string, strokes: Stroke[]) => void;
}

const GlyphCell = memo(({ character, label, initialStrokes, onStrokesChange }: GlyphCellProps) => {
  const canvasRef = useRef<FreehandCanvasRef>(null);
  const [hasStrokes, setHasStrokes] = useState(!!initialStrokes?.length);

  const handleChange = useCallback(
    (strokes: Stroke[]) => {
      setHasStrokes(strokes.length > 0);
      onStrokesChange(character, strokes);
    },
    [character, onStrokesChange],
  );

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setHasStrokes(false);
    onStrokesChange(character, []);
  }, [character, onStrokesChange]);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-body text-muted-foreground">{label}</span>
      <div className="relative border border-border rounded-lg overflow-hidden bg-card" style={{ width: 80, height: 100 }}>
        <FreehandCanvas
          ref={canvasRef}
          inkColor="hsl(15, 20%, 18%)"
          strokeSize={4}
          eraserSize={12}
          width="80px"
          height="100px"
          showLines={false}
          paperColor="hsl(0, 0%, 100%)"
          initialStrokes={initialStrokes}
          onChange={handleChange}
          canvasId={`glyph-${character}`}
        />
      </div>
      <div className="flex gap-1">
        <button
          onClick={handleUndo}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Undo"
        >
          <Undo2 className="w-3 h-3" />
        </button>
        {hasStrokes && (
          <button
            onClick={handleClear}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
            title="Clear"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
});

GlyphCell.displayName = "GlyphCell";

export default GlyphCell;
