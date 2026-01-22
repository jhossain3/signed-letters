import { useRef, useEffect, useState, useCallback } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "./ui/button";

interface SketchCanvasProps {
  onChange?: (dataUrl: string) => void;
  inkColor?: string;
  showLines?: boolean;
}

interface Point {
  x: number;
  y: number;
}

const SketchCanvas = ({ onChange, inkColor = "hsl(15, 20%, 18%)", showLines = true }: SketchCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const points = useRef<Point[]>([]);

  // Get device pixel ratio for sharp rendering
  const getPixelRatio = () => {
    return Math.min(window.devicePixelRatio || 1, 3); // Cap at 3x for performance
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = getPixelRatio();
    
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
    if (showLines) {
      ctx.strokeStyle = "hsl(30, 15%, 88%)";
      ctx.lineWidth = 1;
      for (let y = 32; y < rect.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
    }

    // Set drawing styles
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [inkColor, showLines]);

  useEffect(() => {
    initCanvas();
    
    // Re-init on resize
    const handleResize = () => initCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initCanvas]);

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

  const drawSmoothLine = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      // Use quadratic curves for smooth lines
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      // Connect to last point
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    // Save state for undo
    const pixelRatio = getPixelRatio();
    setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);

    const point = getCoordinates(e);
    lastPoint.current = point;
    points.current = [point];
    
    // Draw a dot for single clicks
    ctx.beginPath();
    ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = inkColor;
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

    // Clear and redraw the current stroke segment with smoothing
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
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
        const p0 = points.current[points.current.length - 3];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
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

    if (showLines) {
      ctx.strokeStyle = "hsl(30, 15%, 88%)";
      ctx.lineWidth = 1;
      for (let y = 32; y < rect.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;

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
};

export default SketchCanvas;
