import React, { useMemo } from "react";
import getStroke from "perfect-freehand";
import type { Stroke } from "./sketch/FreehandCanvas";
import { deserializeMultiPage } from "@/lib/sketchSerialization";

interface SketchPage {
  pageIndex: number;
  strokes: Stroke[];
}

// Calculate the bounding box of all strokes to determine the correct viewBox
function computeViewBox(strokes: Stroke[]): { width: number; height: number } {
  let maxX = 600;
  let maxY = 500;
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (point[0] > maxX) maxX = point[0];
      if (point[1] > maxY) maxY = point[1];
    }
  }
  // Add small padding
  return { width: Math.ceil(maxX + 10), height: Math.ceil(maxY + 10) };
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
              background: paperColor,
            }}
          >
            {(() => {
              const { width, height } = computeViewBox(page.strokes);
              return (
                <svg
                  width="100%"
                  height="500px"
                  viewBox={`0 0 ${width} ${height}`}
                  preserveAspectRatio="xMinYMin meet"
                  style={{ display: "block", shapeRendering: "geometricPrecision" }}
                >
                  {/* Render ruled lines inside SVG so they scale with ink */}
                  {showLines && (() => {
                    const lines: React.ReactElement[] = [];
                    for (let y = 8 + 32; y < height; y += 32) {
                      lines.push(
                        <line
                          key={`line-${y}`}
                          x1="0" y1={y} x2={width} y2={y}
                          stroke="hsl(20, 15%, 85%)"
                          strokeOpacity="0.5"
                          strokeWidth="1"
                        />
                      );
                    }
                    return lines;
                  })()}
                  {(() => {
                    type Layer = { ink: React.ReactElement[]; erasers: React.ReactElement[] };
                    const layers: Layer[] = [{ ink: [], erasers: [] }];
                    let currentLayer = layers[0];
                    let hadEraser = false;
                    
                    page.strokes.forEach((stroke, strokeIndex) => {
                      const outlinePoints = getStroke(stroke.points, getStrokeOptions(stroke.size));
                      const pathData = getSvgPathFromStroke(outlinePoints);
                      const key = `stroke-${page.pageIndex}-${strokeIndex}`;
                      if (stroke.isEraser) {
                        hadEraser = true;
                        currentLayer.erasers.push(<path key={key} d={pathData} fill="black" stroke="none" />);
                      } else {
                        if (hadEraser) {
                          currentLayer = { ink: [], erasers: [] };
                          layers.push(currentLayer);
                          hadEraser = false;
                        }
                        currentLayer.ink.push(<path key={key} d={pathData} fill={stroke.color || inkColor || "hsl(15, 20%, 18%)"} stroke="none" />);
                      }
                    });
                    
                    return layers.map((layer, li) => {
                      if (layer.erasers.length > 0) {
                        const maskId = `eraser-mask-render-${page.pageIndex}-${li}`;
                        return (
                          <g key={`layer-${li}`}>
                            <defs>
                              <mask id={maskId}>
                                <rect width={width} height={height} fill="white" />
                                {layer.erasers}
                              </mask>
                            </defs>
                            <g mask={`url(#${maskId})`}>{layer.ink}</g>
                          </g>
                        );
                      }
                      return <g key={`layer-${li}`}>{layer.ink}</g>;
                    });
                  })()}
                </svg>
              );
            })()}
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
