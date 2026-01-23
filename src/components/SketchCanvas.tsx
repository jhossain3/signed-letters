import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Eraser, Undo2, Trash2, Pen, Circle } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

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

// Theme-complementary colors matching the design system
const SKETCH_COLORS = [
  { name: "Ink", value: "hsl(15, 20%, 18%)" },
  { name: "Maroon", value: "hsl(358, 45%, 35%)" },
  { name: "Charcoal", value: "hsl(20, 8%, 30%)" },
  { name: "Navy", value: "hsl(220, 40%, 25%)" },
  { name: "Forest", value: "hsl(160, 35%, 25%)" },
  { name: "Plum", value: "hsl(280, 30%, 35%)" },
];

const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  ({ onChange, inkColor = "hsl(15, 20%, 18%)", showLines = true, initialData, paperColor = "hsl(38, 35%, 97%)" }, ref) => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [isEraser, setIsEraser] = useState(false);
    const [strokeWidth, setStrokeWidth] = useState(4);
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
        // Parse the paths from the stored JSON data
        try {
          const paths = JSON.parse(initialData);
          if (Array.isArray(paths) && paths.length > 0) {
            canvasRef.current.loadPaths(paths);
          }
        } catch {
          // If not JSON, it might be an old data URL format - ignore
          console.log("Could not parse sketch data as paths");
        }
        isLoadingData.current = false;
      }
    }, [initialData]);

    // Handle stroke changes to enable/disable undo
    const handleStroke = useCallback(() => {
      setCanUndo(true);
      // Save paths as JSON for persistence
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
      // Check if there are still strokes after undo
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

          <div className="w-px h-6 bg-border mx-1" />

          {/* Stroke Width */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                className="rounded-full gap-2"
                title="Stroke Size"
              >
                <Circle className="w-3 h-3" style={{ transform: `scale(${0.5 + strokeWidth / 20})` }} />
                <span className="text-xs">{strokeWidth}px</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="start">
              <div className="space-y-2">
                <div className="text-sm font-medium">Stroke Size</div>
                <Slider
                  value={[strokeWidth]}
                  onValueChange={(value) => setStrokeWidth(value[0])}
                  min={1}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fine</span>
                  <span>Bold</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>

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

        {/* Canvas Container */}
        <div 
          className="rounded-xl border border-border overflow-hidden"
          style={{ 
            background: linePattern !== 'none' ? `${linePattern}, ${paperColor}` : paperColor,
          }}
        >
          <ReactSketchCanvas
            ref={canvasRef}
            width="100%"
            height="500px"
            strokeWidth={strokeWidth}
            strokeColor={currentColor}
            eraserWidth={strokeWidth * 3}
            canvasColor="transparent"
            style={{
              border: "none",
              borderRadius: "0.75rem",
            }}
            onStroke={handleStroke}
            // Palm rejection: prioritize stylus over touch
            allowOnlyPointerType="all"
            // Smooth Bezier curves
            withTimestamp={true}
          />
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          Use your finger, stylus, or mouse to draw. Stylus input is prioritized when available.
        </p>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
