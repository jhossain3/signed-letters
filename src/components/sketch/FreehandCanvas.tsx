import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from "react";
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
    const [isEraser, setIsEraser] = useState(false);
    const hasLoadedInitialData = useRef(false);
    const instanceId = useRef(Math.random().toString(36).substring(7));
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    
    // Use refs for drawing state to avoid re-renders during active drawing
    const isDrawingRef = useRef(false);
    const currentPointsRef = useRef<number[][]>([]);
    const currentPathRef = useRef<SVGPathElement | null>(null);

    // Stable stroke options - no pressure simulation for consistent size
    const penOptions = useMemo(() => ({
      size: strokeSize,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.5,
      easing: (t: number) => t,
      simulatePressure: false,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
    }), [strokeSize]);

    const eraserOptions = useMemo(() => ({
      size: eraserSize,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.5,
      easing: (t: number) => t,
      simulatePressure: false,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
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

    // Get pointer position mapped to SVG viewBox coordinates using inverse CTM
    const getPoint = useCallback((e: React.PointerEvent): number[] => {
      const svg = svgRef.current;
      if (!svg) return [0, 0];
      
      const ctm = svg.getScreenCTM();
      if (!ctm) return [0, 0];
      
      const inverse = ctm.inverse();
      const x = inverse.a * e.clientX + inverse.c * e.clientY + inverse.e;
      const y = inverse.b * e.clientX + inverse.d * e.clientY + inverse.f;
      
      return [x, y];
    }, []);

    // Update the live path element directly (no React state)
    const updateLivePath = useCallback(() => {
      if (!currentPathRef.current || currentPointsRef.current.length === 0) return;
      
      const options = isEraser ? eraserOptions : penOptions;
      const outlinePoints = getStroke(currentPointsRef.current, options);
      const pathData = getSvgPathFromStroke(outlinePoints);
      
      currentPathRef.current.setAttribute("d", pathData);
    }, [isEraser, penOptions, eraserOptions]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (readOnly) return;
      
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      
      isDrawingRef.current = true;
      const point = getPoint(e);
      currentPointsRef.current = [point];
      
      // Create live path element
      const svg = svgRef.current;
      if (svg) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", isEraser ? paperColor : inkColor);
        path.setAttribute("stroke", "none");
        path.id = "live-stroke";
        svg.appendChild(path);
        currentPathRef.current = path;
        updateLivePath();
      }
    }, [readOnly, getPoint, isEraser, paperColor, inkColor, updateLivePath]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (!isDrawingRef.current || readOnly) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const point = getPoint(e);
      currentPointsRef.current.push(point);
      
      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(updateLivePath);
    }, [readOnly, getPoint, updateLivePath]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (!isDrawingRef.current || readOnly) return;
      
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).releasePointerCapture(e.pointerId);
      
      // Remove live path
      if (currentPathRef.current) {
        currentPathRef.current.remove();
        currentPathRef.current = null;
      }
      
      if (currentPointsRef.current.length > 0) {
        const newStroke: Stroke = {
          points: [...currentPointsRef.current],
          color: isEraser ? paperColor : inkColor,
          size: isEraser ? eraserSize : strokeSize,
          isEraser,
        };
        
        setStrokes(prev => {
          const newStrokes = [...prev, newStroke];
          debouncedOnChange(newStrokes);
          return newStrokes;
        });
      }
      
      currentPointsRef.current = [];
      isDrawingRef.current = false;
    }, [readOnly, isEraser, paperColor, inkColor, eraserSize, strokeSize, debouncedOnChange]);

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
        setStrokes(prev => {
          const newStrokes = prev.slice(0, -1);
          debouncedOnChange(newStrokes);
          return newStrokes;
        });
      },
      canUndo: () => strokes.length > 0,
      setEraseMode: (enabled: boolean) => {
        setIsEraser(enabled);
      },
    }), [strokes, onChange, debouncedOnChange]);

    // Memoized stroke paths for completed strokes
    const strokePaths = useMemo(() => {
      return strokes.map((stroke, index) => {
        const options = stroke.isEraser ? eraserOptions : {
          ...penOptions,
          size: stroke.size,
        };
        const outlinePoints = getStroke(stroke.points, options);
        const pathData = getSvgPathFromStroke(outlinePoints);
        
        return (
          <path
            key={`stroke-${canvasId || instanceId.current}-${index}`}
            d={pathData}
            fill={stroke.color}
            stroke="none"
          />
        );
      });
    }, [strokes, penOptions, eraserOptions, canvasId]);

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
        className="rounded-xl border border-border overflow-hidden"
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
          viewBox="0 0 600 500"
          preserveAspectRatio="xMinYMin meet"
          style={{
            touchAction: "none",
            cursor: readOnly ? "default" : isEraser ? "cell" : "crosshair",
            shapeRendering: "geometricPrecision",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {strokePaths}
        </svg>
      </div>
    );
  }
);

FreehandCanvas.displayName = "FreehandCanvas";

export default FreehandCanvas;
