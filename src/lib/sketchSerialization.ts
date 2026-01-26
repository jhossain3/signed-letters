/**
 * Compact stroke serialization using flat Float32-compatible arrays
 * Format: [strokeCount, ...strokeHeaders, ...allPoints]
 * strokeHeader: [pointCount, size, colorIndex, isEraser (0/1)]
 * 
 * This is more efficient than JSON and compatible with Float32Array for potential
 * binary storage in the future.
 */

import type { Stroke } from "@/components/sketch/FreehandCanvas";

// Common color palette - indices stored instead of full strings
const COLOR_PALETTE = [
  "hsl(15, 20%, 18%)",   // 0: Ink (default)
  "hsl(358, 45%, 35%)",  // 1: Maroon
  "hsl(20, 8%, 30%)",    // 2: Charcoal
  "hsl(220, 40%, 25%)",  // 3: Navy
  "hsl(38, 35%, 97%)",   // 4: Paper/eraser color
  "hsl(0, 0%, 100%)",    // 5: White
  "hsl(5, 30%, 95%)",    // 6: Blush
  "hsl(120, 15%, 94%)",  // 7: Sage
];

// Get color index or add to palette dynamically
function getColorIndex(color: string): number {
  const idx = COLOR_PALETTE.indexOf(color);
  return idx >= 0 ? idx : 0; // Default to ink if not found
}

function getColorFromIndex(index: number): string {
  return COLOR_PALETTE[index] || COLOR_PALETTE[0];
}

/**
 * Serialize strokes to a compact flat array format
 * Returns a string representation of numbers for JSON storage
 */
export function serializeStrokes(strokes: Stroke[]): string {
  if (!strokes || strokes.length === 0) return "[]";

  const data: number[] = [];
  
  // Header: version (1), stroke count
  data.push(1); // Version number for future compatibility
  data.push(strokes.length);
  
  // Stroke headers and point data
  for (const stroke of strokes) {
    const pointCount = stroke.points.length;
    const colorIndex = getColorIndex(stroke.color);
    const isEraser = stroke.isEraser ? 1 : 0;
    
    // Header: [pointCount, size * 100 (for precision), colorIndex, isEraser]
    data.push(pointCount);
    data.push(Math.round(stroke.size * 100)); // Store size with 2 decimal precision
    data.push(colorIndex);
    data.push(isEraser);
    
    // Flatten points: [x1, y1, x2, y2, ...]
    for (const point of stroke.points) {
      // Round to 1 decimal place to save space while maintaining quality
      data.push(Math.round(point[0] * 10) / 10);
      data.push(Math.round(point[1] * 10) / 10);
    }
  }
  
  // Return as JSON array of numbers (compact representation)
  return JSON.stringify(data);
}

/**
 * Deserialize compact format back to Stroke[]
 */
export function deserializeStrokes(data: string): Stroke[] | null {
  if (!data || data === "[]") return [];
  
  try {
    const parsed = JSON.parse(data);
    
    // Check if it's the new flat format (starts with version number)
    if (Array.isArray(parsed) && typeof parsed[0] === "number" && parsed[0] === 1) {
      return deserializeFlatFormat(parsed);
    }
    
    // Legacy format detection: array of objects with "points" property
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Multi-page format with pageIndex
      if (parsed[0] && typeof parsed[0] === "object" && "pageIndex" in parsed[0]) {
        return null; // This is multi-page, handled separately
      }
      
      // Old Stroke[] format with points property
      if (parsed[0] && typeof parsed[0] === "object" && "points" in parsed[0]) {
        return parsed as Stroke[];
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse the flat format into Stroke array
 */
function deserializeFlatFormat(data: number[]): Stroke[] {
  const strokes: Stroke[] = [];
  
  const version = data[0];
  if (version !== 1) {
    console.warn(`Unknown sketch format version: ${version}`);
    return [];
  }
  
  const strokeCount = data[1];
  let offset = 2;
  
  for (let i = 0; i < strokeCount; i++) {
    const pointCount = data[offset];
    const size = data[offset + 1] / 100; // Restore decimal precision
    const colorIndex = data[offset + 2];
    const isEraser = data[offset + 3] === 1;
    offset += 4;
    
    const points: number[][] = [];
    for (let p = 0; p < pointCount; p++) {
      const x = data[offset];
      const y = data[offset + 1];
      points.push([x, y]);
      offset += 2;
    }
    
    strokes.push({
      points,
      color: getColorFromIndex(colorIndex),
      size,
      isEraser,
    });
  }
  
  return strokes;
}

/**
 * Multi-page serialization: combine multiple pages into one compact format
 */
export interface SerializedPage {
  pageIndex: number;
  data: string; // Compact stroke data
}

export function serializeMultiPage(pages: { pageIndex: number; strokes: Stroke[] }[]): string {
  const serializedPages = pages
    .filter(p => p.strokes.length > 0)
    .map(p => ({
      p: p.pageIndex,
      d: serializeStrokes(p.strokes),
    }));
  
  return JSON.stringify(serializedPages);
}

export function deserializeMultiPage(data: string): { pageIndex: number; strokes: Stroke[] }[] | null {
  if (!data || data === "[]") return [];
  
  try {
    const parsed = JSON.parse(data);
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    
    // New compact multi-page format: [{ p: pageIndex, d: compactData }, ...]
    if (parsed[0] && typeof parsed[0] === "object" && "p" in parsed[0] && "d" in parsed[0]) {
      return parsed.map((page: { p: number; d: string }) => ({
        pageIndex: page.p,
        strokes: deserializeStrokes(page.d) || [],
      }));
    }
    
    // Legacy multi-page format: [{ pageIndex, strokes: Stroke[] }, ...]
    if (parsed[0] && typeof parsed[0] === "object" && "pageIndex" in parsed[0]) {
      return parsed.map((page: { pageIndex: number; strokes?: Stroke[] }) => ({
        pageIndex: page.pageIndex,
        strokes: page.strokes || [],
      }));
    }
    
    // Legacy single-page format: Stroke[]
    if (parsed[0] && typeof parsed[0] === "object" && "points" in parsed[0]) {
      return [{ pageIndex: 0, strokes: parsed as Stroke[] }];
    }
    
    // New flat format (single page)
    if (typeof parsed[0] === "number" && parsed[0] === 1) {
      return [{ pageIndex: 0, strokes: deserializeFlatFormat(parsed) }];
    }
    
    return [];
  } catch {
    return [];
  }
}
