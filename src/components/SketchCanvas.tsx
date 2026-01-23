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
}

export interface SketchCanvasRef {
  getDataUrl: () => Promise<string>;
  loadData: (dataUrl: string) => void;
  clear: () => void;
}

const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  ({ onChange, inkColor = "hsl(15, 20%, 18%)", showLines = true, initialData, paperColor = "hsl(38, 35%, 97%)" }, ref) => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [isEraser, setIsEraser] = useState(false);
    const [currentColor, setCurrentColor] = useState(inkColor);
    const [canUndo, setCanUndo] = useState(false);
    const isLoadingData = useRef(false);

    // Update color when inkColor prop changes
    useEffect(() => {
      setCurrentColor(inkColor);
    }, [inkColor]);

    // Load initial data when provided
    useEffect(() => {
      if (initialData && canvasRef.current && !isLoadingData.current) {
        isLoadingData.current = true;
        try {
          const paths = JSON.parse(initialData);
          if (Array.isArray(paths) && paths.length > 0) {
            canvasRef.current.loadPaths(paths);
          }
        } catch {
          console.log("Could not parse sketch data as paths");
        }
        isLoadingData.current = false;
      }
    }, [initialData]);

    // Handle stroke changes to enable/disable undo
    const handleStroke = useCallback(() => {
      setCanUndo(true);
      if (canvasRef.current && onChange) {
        canvasRef.current.exportPaths().then((paths) => {
          onChange(JSON.stringify(paths));
        });
      }
    }, [onChange]);

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

    const handleUndo = () => {
      canvasRef.current?.undo();
      canvasRef.current?.exportPaths().then((paths) => {
        setCanUndo(paths.length > 0);
        if (onChange) {
          onChange(JSON.stringify(paths));
        }
      });
    };

    const handleClear = () => {
      canvasRef.current?.clearCanvas();
      setCanUndo(false);
      if (onChange) {
        onChange(JSON.stringify([]));
      }
    };

    const toggleEraser = () => {
      const newEraserState = !isEraser;
      setIsEraser(newEraserState);
      canvasRef.current?.eraseMode(newEraserState);
    };

    const selectPen = () => {
      setIsEraser(false);
      canvasRef.current?.eraseMode(false);
    };

    // Generate line pattern for background
    const linePattern = showLines ? `
      repeating-linear-gradient(
        transparent,
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
          className="rounded-xl border border-border overflow-hidden touch-none"
          style={{ 
            background: linePattern !== 'none' ? `${linePattern}, ${paperColor}` : paperColor,
          }}
        >
          <ReactSketchCanvas
            ref={canvasRef}
            width="100%"
            height="500px"
            strokeWidth={3}
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
          Use your finger, stylus, or mouse to draw
        </p>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
