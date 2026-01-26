import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import getStroke from "perfect-freehand";

export interface Stroke {
  points: number[][];
  color: string;
  size: number;
  isEraser?: boolean;
}

export interface FreehandCanvasProps {
  onChange?: (strokes: Stroke[]) => void;
  inkColor?: string;
  strokeSize?: number;
  eraserSize?: number;
  width?: string;
  height?: string;
  showLines?: boolean;
  paperColor?: string;
  initialStrokes?: Stroke[];
  readOnly?: boolean;
  canvasId?: string;
}

export interface FreehandCanvasRef {
  getStrokes: () => Stroke[];
  loadStrokes: (strokes: Stroke[]) => void;
  clear: () => void;
  undo: () => void;
  canUndo: () => boolean;
  setEraseMode: (enabled: boolean) => void;
}

// Convert stroke points to SVG path using perfect-freehand
function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}

const FreehandCanvas = forwardRef<FreehandCanvasRef, FreehandCanvasProps>(
  (
    {
      onChange,
      inkColor = "hsl(15, 20%, 18%)",
      strokeSize = 3,
      eraserSize = 24,
      width = "100%",
      height = "500px",
      showLines = true,
      paperColor = "hsl(38, 35%, 97%)",
      initialStrokes,
      readOnly = false,
      canvasId,
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEraser, setIsEraser] = useState(false);
    const hasLoadedInitialData = useRef(false);
    const instanceId = useRef(Math.random().toString(36).substring(7));
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Perfect-freehand options for smooth, natural strokes
    const getStrokeOptions = useCallback((size: number, isErasing: boolean) => ({
      size: isErasing ? eraserSize : size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      easing: (t: number) => t,
      simulatePressure: true,
      start: {
        cap: true,
        taper: 0,
      },
      end: {
        cap: true,
        taper: 0,
      },
    }), [eraserSize]);

    // Load initial strokes
    useEffect(() => {
      if (initialStrokes && !hasLoadedInitialData.current) {
        hasLoadedInitialData.current = true;
        setStrokes(initialStrokes);
      }
    }, [initialStrokes]);

    // Debounced onChange
    const debouncedOnChange = useCallback((newStrokes: Stroke[]) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onChange?.(newStrokes);
      }, 300);
    }, [onChange]);

    // Get pointer position relative to SVG
    const getPoint = useCallback((e: React.PointerEvent): number[] => {
      const svg = svgRef.current;
      if (!svg) return [0, 0, 0.5];
      
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;
      
      return [x, y, pressure];
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (readOnly) return;
      
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      
      setIsDrawing(true);
      const point = getPoint(e);
      setCurrentStroke([point]);
    }, [readOnly, getPoint]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (!isDrawing || readOnly) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const point = getPoint(e);
      setCurrentStroke(prev => prev ? [...prev, point] : [point]);
    }, [isDrawing, readOnly, getPoint]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (!isDrawing || readOnly) return;
      
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).releasePointerCapture(e.pointerId);
      
      if (currentStroke && currentStroke.length > 0) {
        const newStroke: Stroke = {
          points: currentStroke,
          color: isEraser ? paperColor : inkColor,
          size: isEraser ? eraserSize : strokeSize,
          isEraser,
        };
        
        const newStrokes = [...strokes, newStroke];
        setStrokes(newStrokes);
        debouncedOnChange(newStrokes);
      }
      
      setCurrentStroke(null);
      setIsDrawing(false);
    }, [isDrawing, readOnly, currentStroke, isEraser, paperColor, inkColor, eraserSize, strokeSize, strokes, debouncedOnChange]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getStrokes: () => strokes,
      loadStrokes: (newStrokes: Stroke[]) => {
        setStrokes(newStrokes);
      },
      clear: () => {
        setStrokes([]);
        onChange?.([]);
      },
      undo: () => {
        const newStrokes = strokes.slice(0, -1);
        setStrokes(newStrokes);
        debouncedOnChange(newStrokes);
      },
      canUndo: () => strokes.length > 0,
      setEraseMode: (enabled: boolean) => {
        setIsEraser(enabled);
      },
    }), [strokes, onChange, debouncedOnChange]);

    // Render stroke as SVG path
    const renderStroke = useCallback((stroke: Stroke, index: number) => {
      const outlinePoints = getStroke(stroke.points, getStrokeOptions(stroke.size, stroke.isEraser || false));
      const pathData = getSvgPathFromStroke(outlinePoints);
      
      return (
        <path
          key={`stroke-${canvasId || instanceId.current}-${index}`}
          d={pathData}
          fill={stroke.color}
          stroke="none"
        />
      );
    }, [getStrokeOptions, canvasId]);

    // Render current stroke being drawn
    const renderCurrentStroke = useCallback(() => {
      if (!currentStroke || currentStroke.length === 0) return null;
      
      const outlinePoints = getStroke(currentStroke, getStrokeOptions(isEraser ? eraserSize : strokeSize, isEraser));
      const pathData = getSvgPathFromStroke(outlinePoints);
      
      return (
        <path
          d={pathData}
          fill={isEraser ? paperColor : inkColor}
          stroke="none"
        />
      );
    }, [currentStroke, isEraser, eraserSize, strokeSize, inkColor, paperColor, getStrokeOptions]);

    // Generate line pattern for background
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
      <div
        className="rounded-xl border border-border overflow-hidden select-none"
        style={{
          background: linePattern !== 'none' ? `${linePattern}, ${paperColor}` : paperColor,
          backgroundPositionY: "8px",
          touchAction: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          width,
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <svg
          ref={svgRef}
          id={canvasId ?? `freehand-${instanceId.current}`}
          width="100%"
          height={height}
          style={{
            touchAction: "none",
            cursor: readOnly ? "default" : isEraser ? "cell" : "crosshair",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Render all completed strokes */}
          {strokes.map((stroke, i) => renderStroke(stroke, i))}
          
          {/* Render current stroke being drawn */}
          {renderCurrentStroke()}
        </svg>
      </div>
    );
  }
);

FreehandCanvas.displayName = "FreehandCanvas";

export default FreehandCanvas;
