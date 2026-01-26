import { useMemo } from "react";
import getStroke from "perfect-freehand";
import type { Stroke } from "./sketch/FreehandCanvas";
import { deserializeMultiPage } from "@/lib/sketchSerialization";

interface SketchPage {
  pageIndex: number;
  strokes: Stroke[];
}

interface SketchRendererProps {
  sketchData: string;
  paperColor?: string;
  inkColor?: string;
  showLines?: boolean;
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

// Perfect-freehand options matching FreehandCanvas exactly
const getStrokeOptions = (size: number) => ({
  size,
  thinning: 0,
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t: number) => t,
  simulatePressure: false,
  start: { cap: true, taper: 0 },
  end: { cap: true, taper: 0 },
});

/**
 * Read-only renderer for sketch data (perfect-freehand strokes)
 * Supports both legacy JSON format and new compact flat array format
 * Used to display saved handwritten letters in the vault
 */
const SketchRenderer = ({
  sketchData,
  paperColor = "hsl(38, 35%, 97%)",
  inkColor,
  showLines = true,
}: SketchRendererProps) => {
  // Parse sketch data using the unified deserializer
  const pages = useMemo((): SketchPage[] => {
    if (!sketchData) return [];
    
    // Use the unified deserializer that handles all formats
    const result = deserializeMultiPage(sketchData);
    return result || [];
  }, [sketchData]);

  if (pages.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-muted-foreground rounded-lg border border-border bg-paper">
        <p>No handwriting to display</p>
      </div>
    );
  }

  // Generate line pattern matching SketchCanvas exactly
  const linePattern = showLines
    ? `
    repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 31px,
      hsl(20, 15%, 85% / 0.5) 31px,
      hsl(20, 15%, 85% / 0.5) 32px
    )
  `
    : "none";

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
              background:
                linePattern !== "none"
                  ? `${linePattern}, ${paperColor}`
                  : paperColor,
              backgroundPositionY: "8px",
            }}
          >
            <svg
              width="100%"
              height="500px"
              viewBox="0 0 600 500"
              preserveAspectRatio="xMinYMin meet"
              style={{ display: "block", shapeRendering: "geometricPrecision" }}
            >
              {page.strokes.map((stroke, strokeIndex) => {
                const outlinePoints = getStroke(
                  stroke.points,
                  getStrokeOptions(stroke.size)
                );
                const pathData = getSvgPathFromStroke(outlinePoints);

                return (
                  <path
                    key={`stroke-${page.pageIndex}-${strokeIndex}`}
                    d={pathData}
                    fill={stroke.isEraser ? paperColor : (stroke.color || inkColor || "hsl(15, 20%, 18%)")}
                    stroke="none"
                  />
                );
              })}
            </svg>
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
