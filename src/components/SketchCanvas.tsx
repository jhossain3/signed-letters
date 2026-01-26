import { useRef, useImperativeHandle, forwardRef, useState, useCallback, useEffect } from "react";
import { FreehandCanvas, FreehandCanvasRef, Stroke, SketchToolbar } from "./sketch";

interface SketchCanvasProps {
  onChange?: (dataUrl: string) => void;
  inkColor?: string;
  showLines?: boolean;
  initialData?: string;
  paperColor?: string;
  /**
   * IMPORTANT: When rendering multiple canvases on the same page, each instance
   * MUST have a stable unique id to avoid SVG collisions.
   */
  canvasId?: string;
}

export interface SketchCanvasRef {
  getDataUrl: () => Promise<string>;
  loadData: (dataUrl: string) => void;
  clear: () => void;
}

// Convert strokes to serializable format
function strokesToJson(strokes: Stroke[]): string {
  return JSON.stringify(strokes);
}

// Parse JSON to strokes
function jsonToStrokes(json: string): Stroke[] | null {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      // Check if it's new format (Stroke[])
      if (parsed.length === 0 || (parsed[0] && 'points' in parsed[0])) {
        return parsed as Stroke[];
      }
      // Legacy format from react-sketch-canvas - return empty, can't convert
      console.log("Legacy sketch format detected, starting fresh");
      return [];
    }
    return null;
  } catch {
    return null;
  }
}

const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  (
    {
      onChange,
      inkColor = "hsl(15, 20%, 18%)",
      showLines = true,
      initialData,
      paperColor = "hsl(38, 35%, 97%)",
      canvasId,
    },
    ref
  ) => {
    const canvasRef = useRef<FreehandCanvasRef>(null);
    const [isEraser, setIsEraser] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [initialStrokes, setInitialStrokes] = useState<Stroke[] | undefined>();
    const hasLoadedInitialData = useRef(false);

    // Load initial data once
    useEffect(() => {
      if (initialData && !hasLoadedInitialData.current) {
        hasLoadedInitialData.current = true;
        const strokes = jsonToStrokes(initialData);
        if (strokes && strokes.length > 0) {
          setInitialStrokes(strokes);
          setCanUndo(true);
        }
      }
    }, [initialData]);

    // Handle stroke changes
    const handleChange = useCallback((strokes: Stroke[]) => {
      setCanUndo(strokes.length > 0);
      if (onChange) {
        onChange(strokesToJson(strokes));
      }
    }, [onChange]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getDataUrl: async () => {
        if (canvasRef.current) {
          return strokesToJson(canvasRef.current.getStrokes());
        }
        return "[]";
      },
      loadData: (data: string) => {
        if (canvasRef.current) {
          const strokes = jsonToStrokes(data);
          if (strokes) {
            canvasRef.current.loadStrokes(strokes);
            setCanUndo(strokes.length > 0);
          }
        }
      },
      clear: () => {
        canvasRef.current?.clear();
        setCanUndo(false);
      }
    }), []);

    const handlePen = useCallback(() => {
      setIsEraser(false);
      canvasRef.current?.setEraseMode(false);
    }, []);

    const handleEraser = useCallback(() => {
      setIsEraser(true);
      canvasRef.current?.setEraseMode(true);
    }, []);

    const handleUndo = useCallback(() => {
      canvasRef.current?.undo();
      setCanUndo(canvasRef.current?.canUndo() || false);
    }, []);

    const handleClear = useCallback(() => {
      canvasRef.current?.clear();
      setCanUndo(false);
    }, []);

    return (
      <div className="space-y-3">
        {/* Toolbar */}
        <SketchToolbar
          isEraser={isEraser}
          canUndo={canUndo}
          onPenClick={handlePen}
          onEraserClick={handleEraser}
          onUndoClick={handleUndo}
          onClearClick={handleClear}
        />

        {/* Canvas */}
        <div
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <FreehandCanvas
            ref={canvasRef}
            inkColor={inkColor}
            strokeSize={3}
            eraserSize={24}
            height="500px"
            showLines={showLines}
            paperColor={paperColor}
            initialStrokes={initialStrokes}
            onChange={handleChange}
            canvasId={canvasId}
          />
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          Draw with your finger, stylus, or mouse • Pressure-sensitive
        </p>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
