import { useRef, useEffect, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";

interface SketchPage {
  pageIndex: number;
  paths: unknown[];
}

interface SketchRendererProps {
  sketchData: string;
  paperColor?: string;
  inkColor?: string;
  showLines?: boolean;
}

/**
 * Read-only renderer for sketch data (JSON paths from react-sketch-canvas)
 * Supports both legacy single-page format and new multi-page format
 * Used to display saved handwritten letters in the vault
 */
const SketchRenderer = ({ 
  sketchData, 
  paperColor = "hsl(38, 35%, 97%)", 
  inkColor,
  showLines = true 
}: SketchRendererProps) => {
  const [pages, setPages] = useState<SketchPage[]>([]);
  const canvasRefs = useRef<Map<number, ReactSketchCanvasRef>>(new Map());
  const hasLoaded = useRef(false);

  // Parse sketch data and determine format
  useEffect(() => {
    if (!sketchData || hasLoaded.current) return;
    
    try {
      const parsed = JSON.parse(sketchData);
      
      // Check if it's the new multi-page format
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Check if first element has pageIndex (multi-page format)
        if (parsed[0] && typeof parsed[0] === 'object' && 'pageIndex' in parsed[0]) {
          // New multi-page format: [{ pageIndex: 0, paths: [...] }, ...]
          setPages(parsed as SketchPage[]);
        } else {
          // Legacy single-page format: array of paths directly
          setPages([{ pageIndex: 0, paths: parsed }]);
        }
        hasLoaded.current = true;
      }
    } catch {
      console.log("Could not parse sketch data");
    }
  }, [sketchData]);

  // Load paths into canvases once pages are set
  useEffect(() => {
    pages.forEach((page) => {
      const ref = canvasRefs.current.get(page.pageIndex);
      if (ref && page.paths.length > 0) {
        ref.loadPaths(page.paths as any);
      }
    });
  }, [pages]);

  if (pages.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-muted-foreground rounded-lg border border-border bg-paper">
        <p>No handwriting to display</p>
      </div>
    );
  }

  // Generate line pattern matching SketchCanvas exactly
  const linePattern = showLines ? `
    repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 31px,
      hsl(20, 15%, 85% / 0.5) 31px,
      hsl(20, 15%, 85% / 0.5) 32px
    )
  ` : 'none';

  return (
    <div className="space-y-6">
      {pages.map((page, index) => (
        <div key={`render-page-${page.pageIndex}`}>
          {pages.length > 1 && (
            <p className="text-xs text-muted-foreground/60 mb-2">
              Page {index + 1}
            </p>
          )}
          <div 
            className="w-full rounded-xl border border-border overflow-hidden"
            style={{ 
              background: linePattern !== 'none' ? `${linePattern}, ${paperColor}` : paperColor,
              backgroundPositionY: "8px", // Match SketchCanvas line alignment
            }}
          >
            <ReactSketchCanvas
              ref={(ref) => {
                if (ref) {
                  canvasRefs.current.set(page.pageIndex, ref);
                }
              }}
              id={`sketch-view-${page.pageIndex}-${Date.now()}`}
              width="100%"
              height="500px"
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
          {/* Page divider */}
          {index < pages.length - 1 && (
            <div className="border-b border-dashed border-border/40 mt-6" />
          )}
        </div>
      ))}
    </div>
  );
};

export default SketchRenderer;
