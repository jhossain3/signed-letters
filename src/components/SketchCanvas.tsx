import { useRef, useImperativeHandle, forwardRef, useState, useCallback, useEffect } from "react";
import { FreehandCanvas, FreehandCanvasRef, Stroke, SketchToolbar } from "./sketch";
import { useIsMobile } from "@/hooks/use-mobile";
import { Hand, Pencil } from "lucide-react";
import { Button } from "./ui/button";

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
      if (parsed.length === 0 || (parsed[0] && "points" in parsed[0])) {
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
    ref,
  ) => {
    const canvasRef = useRef<FreehandCanvasRef>(null);
    const [isEraser, setIsEraser] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [initialStrokes, setInitialStrokes] = useState<Stroke[] | undefined>();
    const hasLoadedInitialData = useRef(false);
    const isMobile = useIsMobile();
    const [scrollMode, setScrollMode] = useState(false);

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
    const handleChange = useCallback(
      (strokes: Stroke[]) => {
        setCanUndo(strokes.length > 0);
        if (onChange) {
          onChange(strokesToJson(strokes));
        }
      },
      [onChange],
    );

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
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
        },
      }),
      [],
    );

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
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SketchToolbar
              isEraser={isEraser}
              canUndo={canUndo}
              onPenClick={handlePen}
              onEraserClick={handleEraser}
              onUndoClick={handleUndo}
              onClearClick={handleClear}
            />
          </div>
          {isMobile && (
            <Button
              type="button"
              variant={scrollMode ? "default" : "outline"}
              size="sm"
              onClick={() => setScrollMode(!scrollMode)}
              className="rounded-full shrink-0"
              title={scrollMode ? "Switch to Draw" : "Switch to Scroll"}
            >
              {scrollMode ? <Pencil className="w-4 h-4 mr-1" /> : <Hand className="w-4 h-4 mr-1" />}
              {scrollMode ? "Draw" : "Scroll"}
            </Button>
          )}
        </div>

        {/* Canvas */}
        <div
          onTouchStart={(e) => { if (!scrollMode) e.stopPropagation(); }}
          onTouchMove={(e) => { if (!scrollMode) e.stopPropagation(); }}
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
            readOnly={scrollMode}
          />
        </div>
      </div>
    );
  },
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
