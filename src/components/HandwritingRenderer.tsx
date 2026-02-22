import { useMemo } from "react";
import getStroke from "perfect-freehand";

interface HandwritingRendererProps {
  text: string;
  glyphMap: Map<string, string>;
  inkColor?: string;
  lineHeight?: number;
  charWidth?: number;
  containerWidth?: number;
}

// Same path helper used in FreehandCanvas
function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"],
  );
  d.push("Z");
  return d.join(" ");
}

// Parse stroke data from the glyph cell format
function parseStrokes(data: string): Array<{ points: number[][]; color: string; size: number; isEraser?: boolean }> {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.points) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

const GLYPH_OPTIONS = {
  size: 2.5,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t: number) => t,
  start: { taper: 0, cap: true },
  end: { taper: 0, cap: true },
};

/**
 * Renders text using hand-drawn glyph SVG paths.
 * Each character is rendered as a small inline SVG.
 * Falls back to a styled <span> for missing glyphs.
 */
const HandwritingRenderer = ({
  text,
  glyphMap,
  inkColor = "hsl(15, 20%, 18%)",
  lineHeight = 32,
  charWidth = 22,
}: HandwritingRendererProps) => {
  const renderedChars = useMemo(() => {
    return text.split("").map((char, idx) => {
      if (char === "\n") {
        return <br key={idx} />;
      }
      if (char === " ") {
        return (
          <span key={idx} style={{ display: "inline-block", width: charWidth * 0.5 }} />
        );
      }

      const strokeData = glyphMap.get(char);
      if (!strokeData) {
        // Fallback: render as styled text
        return (
          <span
            key={idx}
            className="font-handwritten inline-block"
            style={{
              color: inkColor,
              fontSize: lineHeight * 0.7,
              width: charWidth,
              textAlign: "center",
              lineHeight: `${lineHeight}px`,
            }}
          >
            {char}
          </span>
        );
      }

      const strokes = parseStrokes(strokeData);
      if (strokes.length === 0) {
        return (
          <span
            key={idx}
            className="font-handwritten inline-block"
            style={{ color: inkColor, fontSize: lineHeight * 0.7, width: charWidth, textAlign: "center" }}
          >
            {char}
          </span>
        );
      }

      // Compute bounding box of strokes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of strokes) {
        for (const p of s.points) {
          if (p[0] < minX) minX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] > maxY) maxY = p[1];
        }
      }
      const padding = 4;
      const vbX = minX - padding;
      const vbY = minY - padding;
      const vbW = Math.max(maxX - minX + padding * 2, 10);
      const vbH = Math.max(maxY - minY + padding * 2, 10);

      const paths = strokes
        .filter((s) => !s.isEraser)
        .map((s, si) => {
          const outline = getStroke(s.points, { ...GLYPH_OPTIONS, size: s.size });
          const d = getSvgPathFromStroke(outline);
          return <path key={si} d={d} fill={inkColor} />;
        });

      return (
        <svg
          key={idx}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          width={charWidth}
          height={lineHeight}
          style={{ display: "inline-block", verticalAlign: "bottom" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {paths}
        </svg>
      );
    });
  }, [text, glyphMap, inkColor, lineHeight, charWidth]);

  return <div className="flex flex-wrap items-end">{renderedChars}</div>;
};

export default HandwritingRenderer;
