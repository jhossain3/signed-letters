import { useRef, useEffect } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";

interface SketchRendererProps {
  sketchData: string;
  paperColor?: string;
  inkColor?: string;
}

/**
 * Read-only renderer for sketch data (JSON paths from react-sketch-canvas)
 * Used to display saved handwritten letters in the vault
 */
const SketchRenderer = ({ sketchData, paperColor = "hsl(38, 35%, 97%)", inkColor }: SketchRendererProps) => {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (sketchData && canvasRef.current && !hasLoaded.current) {
      hasLoaded.current = true;
      try {
        const paths = JSON.parse(sketchData);
        if (Array.isArray(paths) && paths.length > 0) {
          canvasRef.current.loadPaths(paths);
        }
      } catch {
        console.log("Could not parse sketch data");
      }
    }
  }, [sketchData]);

  // Check if data is valid JSON paths
  let isValidSketchData = false;
  try {
    const parsed = JSON.parse(sketchData);
    isValidSketchData = Array.isArray(parsed) && parsed.length > 0;
  } catch {
    isValidSketchData = false;
  }

  if (!isValidSketchData) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-muted-foreground rounded-lg border border-border bg-paper">
        <p>No handwriting to display</p>
      </div>
    );
  }

  return (
    <div 
      className="w-full rounded-xl border border-border overflow-hidden"
      style={{ backgroundColor: paperColor }}
    >
      <ReactSketchCanvas
        ref={canvasRef}
        id={`sketch-view-${Date.now()}`}
        width="100%"
        height="400px"
        strokeWidth={2}
        strokeColor={inkColor || "hsl(15, 20%, 18%)"}
        canvasColor="transparent"
        style={{
          border: "none",
          borderRadius: "0.75rem",
          pointerEvents: "none", // Make it non-interactive
        }}
        allowOnlyPointerType="all"
      />
    </div>
  );
};

export default SketchRenderer;