import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "./ui/button";

interface SketchCanvasProps {
  onChange?: (dataUrl: string) => void;
  inkColor?: string;
  showLines?: boolean;
  initialData?: string;
}

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface SketchCanvasRef {
  getDataUrl: () => string;
  loadData: (dataUrl: string) => void;
}

const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  ({ onChange, inkColor = "hsl(15, 20%, 18%)", showLines = true, initialData }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const lastPoint = useRef<Point | null>(null);
    const points = useRef<Point[]>([]);
    const currentInkColor = useRef(inkColor);
    const isInitialized = useRef(false);
    const pixelRatioRef = useRef(1);

    // Update ink color ref when prop changes
    useEffect(() => {
      currentInkColor.current = inkColor;
    }, [inkColor]);

    // Get device pixel ratio for sharp rendering
    const getPixelRatio = useCallback(() => {
      return Math.min(window.devicePixelRatio || 1, 3);
    }, []);

    const drawLines = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!showLines) return;
      ctx.strokeStyle = "hsl(30, 15%, 88%)";
      ctx.lineWidth = 1;
      for (let y = 32; y < height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }, [showLines]);

    const initCanvas = useCallback((preserveContent = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const pixelRatio = getPixelRatio();
      pixelRatioRef.current = pixelRatio;
      
      // Save existing content if preserving
      let existingImage: ImageData | null = null;
      if (preserveContent && isInitialized.current) {
        existingImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      
      // Set canvas size with pixel ratio for sharpness
      canvas.width = rect.width * pixelRatio;
      canvas.height = rect.height * pixelRatio;
      
      // Scale context to match pixel ratio
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      // Enable smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Fill with paper color
      ctx.fillStyle = "hsl(38, 35%, 97%)";
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw lines if enabled
      drawLines(ctx, rect.width, rect.height);

      // Restore existing content if we had it
      if (existingImage && preserveContent) {
        // Need to reset transform to put image data
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.putImageData(existingImage, 0, 0);
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }

      // Set drawing styles
      ctx.strokeStyle = currentInkColor.current;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      isInitialized.current = true;
    }, [drawLines, getPixelRatio]);

    // Initial setup
    useEffect(() => {
      initCanvas(false);
      
      // Load initial data if provided
      if (initialData) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) {
          const img = new Image();
          img.onload = () => {
            const rect = canvas.getBoundingClientRect();
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
          };
          img.src = initialData;
        }
      }
    }, []);

    // Handle resize
    useEffect(() => {
      const handleResize = () => initCanvas(true);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [initCanvas]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getDataUrl: () => {
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL("image/png", 1.0) : "";
      },
      loadData: (dataUrl: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        
        const img = new Image();
        img.onload = () => {
          const rect = canvas.getBoundingClientRect();
          ctx.fillStyle = "hsl(38, 35%, 97%)";
          ctx.fillRect(0, 0, rect.width, rect.height);
          drawLines(ctx, rect.width, rect.height);
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = dataUrl;
      }
    }), [drawLines]);

    // Get coordinates relative to canvas, accounting for all transforms
    const getCoordinates = useCallback((e: PointerEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

      const rect = canvas.getBoundingClientRect();
      
      // Calculate position relative to canvas element
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Get pressure from pointer event (stylus support)
      const pressure = e.pressure > 0 ? e.pressure : 0.5;

      return { x, y, pressure };
    }, []);

    const startDrawing = useCallback((e: PointerEvent) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;

      // Capture pointer for this element
      canvas.setPointerCapture(e.pointerId);

      // Save state for undo
      const pixelRatio = pixelRatioRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const point = getCoordinates(e);
      lastPoint.current = point;
      points.current = [point];
      
      // Draw a dot for single clicks
      ctx.beginPath();
      const radius = (ctx.lineWidth / 2) * (point.pressure || 0.5);
      ctx.arc(point.x, point.y, Math.max(radius, 1), 0, Math.PI * 2);
      ctx.fillStyle = currentInkColor.current;
      ctx.fill();
      
      setIsDrawing(true);
    }, [getCoordinates]);

    const draw = useCallback((e: PointerEvent) => {
      if (!isDrawing) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !lastPoint.current) return;

      const currentPoint = getCoordinates(e);
      points.current.push(currentPoint);

      // Keep only recent points for smooth curve calculation
      if (points.current.length > 4) {
        points.current = points.current.slice(-4);
      }

      // Set drawing styles with pressure sensitivity
      ctx.strokeStyle = currentInkColor.current;
      const baseWidth = 3.5;
      ctx.lineWidth = baseWidth * (currentPoint.pressure || 0.5) * 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw smooth line through recent points
      if (points.current.length >= 2) {
        const p1 = points.current[points.current.length - 2];
        const p2 = currentPoint;
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        
        // Use midpoint for smoother curves
        if (points.current.length >= 3) {
          ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        } else {
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
      }

      lastPoint.current = currentPoint;
    }, [isDrawing, getCoordinates]);

    const stopDrawing = useCallback((e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Release pointer capture
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (!isDrawing) return;
      
      setIsDrawing(false);
      lastPoint.current = null;
      points.current = [];

      if (onChange) {
        onChange(canvas.toDataURL("image/png", 1.0));
      }
    }, [isDrawing, onChange]);

    // Set up pointer event listeners
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handlePointerDown = (e: PointerEvent) => {
        e.preventDefault();
        startDrawing(e);
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (isDrawing) {
          e.preventDefault();
        }
        draw(e);
      };

      const handlePointerUp = (e: PointerEvent) => {
        stopDrawing(e);
      };

      const handlePointerCancel = (e: PointerEvent) => {
        stopDrawing(e);
      };

      // Prevent context menu on long press
      const handleContextMenu = (e: Event) => {
        e.preventDefault();
      };

      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("pointercancel", handlePointerCancel);
      canvas.addEventListener("pointerleave", handlePointerUp);
      canvas.addEventListener("contextmenu", handleContextMenu);

      return () => {
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointermove", handlePointerMove);
        canvas.removeEventListener("pointerup", handlePointerUp);
        canvas.removeEventListener("pointercancel", handlePointerCancel);
        canvas.removeEventListener("pointerleave", handlePointerUp);
        canvas.removeEventListener("contextmenu", handleContextMenu);
      };
    }, [isDrawing, startDrawing, draw, stopDrawing]);

    const clearCanvas = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;

      const rect = canvas.getBoundingClientRect();

      ctx.fillStyle = "hsl(38, 35%, 97%)";
      ctx.fillRect(0, 0, rect.width, rect.height);

      drawLines(ctx, rect.width, rect.height);

      ctx.strokeStyle = currentInkColor.current;
      ctx.lineWidth = 3.5;

      setHistory([]);

      if (onChange) {
        onChange(canvas.toDataURL("image/png", 1.0));
      }
    };

    const undo = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas || history.length === 0) return;

      const lastState = history[history.length - 1];
      const pixelRatio = pixelRatioRef.current;
      
      // Reset transform to put image data
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(lastState, 0, 0);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      
      setHistory(prev => prev.slice(0, -1));

      if (onChange) {
        onChange(canvas.toDataURL("image/png", 1.0));
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={history.length === 0} className="rounded-full">
            <Undo2 className="w-4 h-4 mr-1" />
            Undo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearCanvas} className="rounded-full">
            <Eraser className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
        <div 
          ref={containerRef}
          className="overflow-y-auto max-h-[70vh] rounded-xl border border-border bg-paper"
          style={{ 
            // Allow scrolling on container when not drawing
            touchAction: isDrawing ? "none" : "pan-y",
            overscrollBehavior: "contain"
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-[500px] cursor-crosshair"
            style={{ 
              // Prevent default touch behaviors on canvas itself
              touchAction: "none",
              // Prevent text selection
              userSelect: "none",
              WebkitUserSelect: "none",
              // Prevent callout on iOS
              WebkitTouchCallout: "none"
            }}
          />
        </div>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
