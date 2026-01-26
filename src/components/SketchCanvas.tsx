import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Eraser, Undo2, Trash2, Pen } from "lucide-react";
import { Button } from "./ui/button";

interface SketchCanvasProps {
  onChange?: (dataUrl: string) => void;
  inkColor?: string;
  showLines?: boolean;
  initialData?: string;
  paperColor?: string;
  /**
   * IMPORTANT: When rendering multiple canvases on the same page, each instance
   * MUST have a stable unique id to avoid SVG <defs>/mask collisions (eraser/undo bleeding).
   */
  canvasId?: string;
}

export interface SketchCanvasRef {
  getDataUrl: () => Promise<string>;
  loadData: (dataUrl: string) => void;
  clear: () => void;
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
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [isEraser, setIsEraser] = useState(false);
    const [currentColor, setCurrentColor] = useState(inkColor);
    const [canUndo, setCanUndo] = useState(false);
    
    // Use a unique instance ID to track this specific canvas instance
    const instanceId = useRef(Math.random().toString(36).substring(7));
    // Track if we've already loaded initial data to prevent re-loading
    const hasLoadedInitialData = useRef(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Update color when inkColor prop changes
    useEffect(() => {
      setCurrentColor(inkColor);
    }, [inkColor]);

    // Load initial data ONLY once on mount
    useEffect(() => {
      if (initialData && canvasRef.current && !hasLoadedInitialData.current) {
        hasLoadedInitialData.current = true;
        try {
          const paths = JSON.parse(initialData);
          if (Array.isArray(paths) && paths.length > 0) {
            canvasRef.current.loadPaths(paths);
            setCanUndo(true);
          }
        } catch {
          console.log("Could not parse sketch data as paths");
        }
      }
    }, []); // Empty dependency - only run once on mount

    // Debounced save to prevent performance issues - each instance saves its own data
    const debouncedSave = useCallback((paths: unknown[]) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        if (onChange) {
          onChange(JSON.stringify(paths));
        }
      }, 300); // Debounce by 300ms
    }, [onChange]);

    // Handle stroke changes
    const handleStroke = useCallback(() => {
      setCanUndo(true);
      if (canvasRef.current) {
        canvasRef.current.exportPaths().then((paths) => {
          debouncedSave(paths);
        });
      }
    }, [debouncedSave]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getDataUrl: async () => {
        if (canvasRef.current) {
          const paths = await canvasRef.current.exportPaths();
          return JSON.stringify(paths);
        }
        return "";
      },
      loadData: (data: string) => {
        if (canvasRef.current) {
          try {
            const paths = JSON.parse(data);
            if (Array.isArray(paths)) {
              canvasRef.current.loadPaths(paths);
            }
          } catch {
            console.log("Could not load sketch data");
          }
        }
      },
      clear: () => {
        canvasRef.current?.clearCanvas();
        setCanUndo(false);
      }
    }), []);

    const handleUndo = useCallback(() => {
      canvasRef.current?.undo();
      canvasRef.current?.exportPaths().then((paths) => {
        setCanUndo(paths.length > 0);
        debouncedSave(paths);
      });
    }, [debouncedSave]);

    const handleClear = useCallback(() => {
      canvasRef.current?.clearCanvas();
      setCanUndo(false);
      if (onChange) {
        onChange(JSON.stringify([]));
      }
    }, [onChange]);

    const toggleEraser = useCallback(() => {
      const newEraserState = !isEraser;
      setIsEraser(newEraserState);
      canvasRef.current?.eraseMode(newEraserState);
    }, [isEraser]);

    const selectPen = useCallback(() => {
      setIsEraser(false);
      canvasRef.current?.eraseMode(false);
    }, []);

    // Generate line pattern for background - align with 32px line height
    // Start lines after a small top margin so handwriting sits ON lines
    const linePattern = showLines ? `
      repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 31px,
        hsl(20, 15%, 85%) 31px,
        hsl(20, 15%, 85%) 32px
      )
    ` : 'none';

    return (
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-2 bg-card/80 rounded-xl border border-border/50">
          {/* Pen Tool */}
          <Button 
            type="button" 
            variant={!isEraser ? "default" : "outline"} 
            size="sm" 
            onClick={selectPen}
            className="rounded-full"
            title="Pen"
          >
            <Pen className="w-4 h-4" />
          </Button>

          {/* Eraser Tool */}
          <Button 
            type="button" 
            variant={isEraser ? "default" : "outline"} 
            size="sm" 
            onClick={toggleEraser}
            className="rounded-full"
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </Button>

          <div className="flex-1" />

          {/* Undo */}
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleUndo} 
            disabled={!canUndo}
            className="rounded-full"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </Button>

          {/* Clear */}
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleClear}
            className="rounded-full text-destructive hover:text-destructive"
            title="Clear Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Canvas Container - Touch-optimized for seamless writing */}
        <div 
          className="rounded-xl border border-border overflow-hidden"
          style={{ 
            background: linePattern !== 'none' ? `${linePattern}, ${paperColor}` : paperColor,
            backgroundPositionY: "8px", // Offset lines so handwriting sits ON them
            touchAction: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <ReactSketchCanvas
            ref={canvasRef}
            id={canvasId ?? `sketch-${instanceId.current}`}
            width="100%"
            height="500px"
            strokeWidth={2}
            strokeColor={currentColor}
            eraserWidth={20}
            canvasColor="transparent"
            style={{
              border: "none",
              borderRadius: "0.75rem",
              touchAction: "none",
            }}
            onStroke={handleStroke}
            allowOnlyPointerType="all"
            withTimestamp={true}
          />
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          Draw with your finger, stylus, or mouse
        </p>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
