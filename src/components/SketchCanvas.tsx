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
}

export interface SketchCanvasRef {
  getDataUrl: () => string;
  loadData: (dataUrl: string) => void;
}

const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  ({ onChange, inkColor = "hsl(15, 20%, 18%)", showLines = true, initialData }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const lastPoint = useRef<Point | null>(null);
    const points = useRef<Point[]>([]);
    const currentInkColor = useRef(inkColor);
    const isInitialized = useRef(false);

    // Update ink color ref when prop changes (without reinitializing canvas)
    useEffect(() => {
      currentInkColor.current = inkColor;
    }, [inkColor]);

    // Get device pixel ratio for sharp rendering
    const getPixelRatio = () => {
      return Math.min(window.devicePixelRatio || 1, 3); // Cap at 3x for performance
    };

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
      
      // Save existing content if preserving
      let existingImage: ImageData | null = null;
      if (preserveContent && isInitialized.current) {
        existingImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      
      // Set canvas size with pixel ratio for sharpness
      canvas.width = rect.width * pixelRatio;
      canvas.height = rect.height * pixelRatio;
      ctx.scale(pixelRatio, pixelRatio);

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
        ctx.putImageData(existingImage, 0, 0);
      }

      // Set drawing styles - thicker, more solid ink
      ctx.strokeStyle = currentInkColor.current;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      isInitialized.current = true;
    }, [drawLines]);

    // Initial setup - only once
    useEffect(() => {
      initCanvas(false);
      
      // Load initial data if provided
      if (initialData) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) {
          const img = new Image();
          img.onload = () => {
            const pixelRatio = getPixelRatio();
            ctx.drawImage(img, 0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
          };
          img.src = initialData;
        }
      }
    }, []); // Only run once on mount

    // Handle resize
    useEffect(() => {
      const handleResize = () => initCanvas(true);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [initCanvas]);

    // Handle showLines changes - redraw lines without clearing content
    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas || !isInitialized.current) return;

      // We need to save and restore to toggle lines
      // This is a bit complex because lines are under the drawing
      // For now, just update on next clear - lines toggle is immediate visual
    }, [showLines]);

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
          const pixelRatio = getPixelRatio();
          ctx.drawImage(img, 0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
        };
        img.src = dataUrl;
      }
    }), [drawLines]);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      
      if ("touches" in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }
      
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;

      // Save state for undo
      setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);

      const point = getCoordinates(e);
      lastPoint.current = point;
      points.current = [point];
      
      // Draw a dot for single clicks - use current ink color
      ctx.beginPath();
      ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = currentInkColor.current;
      ctx.fill();
      
      setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
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

      // Use current ink color for drawing - thicker, more solid ink
      ctx.strokeStyle = currentInkColor.current;
      ctx.lineWidth = 3.5;
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
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      
      const canvas = canvasRef.current;
      setIsDrawing(false);
      lastPoint.current = null;
      points.current = [];

      if (canvas && onChange) {
        onChange(canvas.toDataURL("image/png", 1.0));
      }
    };

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
      ctx.putImageData(lastState, 0, 0);
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
        <div className="overflow-y-auto max-h-[70vh] rounded-xl border border-border bg-paper">
          <canvas
            ref={canvasRef}
            className="w-full h-[500px] cursor-crosshair touch-none"
            style={{ touchAction: "none" }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>
    );
  }
);

SketchCanvas.displayName = "SketchCanvas";

export default SketchCanvas;
