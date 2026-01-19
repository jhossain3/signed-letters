import { useRef, useEffect, useState } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "./ui/button";

interface SketchCanvasProps {
  onChange?: (dataUrl: string) => void;
  inkColor?: string;
  showLines?: boolean;
}

const SketchCanvas = ({ onChange, inkColor = "hsl(15, 20%, 18%)", showLines = true }: SketchCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill with paper color
    ctx.fillStyle = "hsl(38, 35%, 97%)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2;
  }, [inkColor, showLines]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.closePath();
    setIsDrawing(false);

    if (canvas && onChange) {
      onChange(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();

    ctx.fillStyle = "hsl(38, 35%, 97%)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    ctx.lineWidth = 2;

    if (onChange) {
      onChange(canvas.toDataURL());
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
      onChange(canvas.toDataURL());
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
      <div className="overflow-y-auto max-h-[70vh] rounded-xl border border-border">
        <canvas
          ref={canvasRef}
          className="w-full h-[500px] cursor-crosshair touch-none"
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
