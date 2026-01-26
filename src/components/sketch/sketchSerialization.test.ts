import { describe, it, expect } from "vitest";
import type { Stroke } from "./FreehandCanvas";

// These functions are inlined in SketchCanvas, so we test the logic here
function strokesToJson(strokes: Stroke[]): string {
  return JSON.stringify(strokes);
}

function jsonToStrokes(json: string): Stroke[] | null {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      // Check if it's new format (Stroke[])
      if (parsed.length === 0 || (parsed[0] && "points" in parsed[0])) {
        return parsed as Stroke[];
      }
      // Legacy format - return empty
      console.log("Legacy sketch format detected, starting fresh");
      return [];
    }
    return null;
  } catch {
    return null;
  }
}

describe("strokesToJson", () => {
  it("should serialize empty strokes array", () => {
    const result = strokesToJson([]);
    expect(result).toBe("[]");
    expect(JSON.parse(result)).toEqual([]);
  });

  it("should serialize single stroke", () => {
    const strokes: Stroke[] = [
      {
        points: [[0, 0], [10, 10], [20, 20]],
        color: "black",
        size: 3,
      },
    ];

    const result = strokesToJson(strokes);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].points).toEqual([[0, 0], [10, 10], [20, 20]]);
    expect(parsed[0].color).toBe("black");
    expect(parsed[0].size).toBe(3);
  });

  it("should serialize multiple strokes with eraser", () => {
    const strokes: Stroke[] = [
      { points: [[0, 0], [50, 50]], color: "hsl(15, 20%, 18%)", size: 3 },
      { points: [[100, 100], [150, 150]], color: "white", size: 24, isEraser: true },
      { points: [[200, 200]], color: "blue", size: 5, isEraser: false },
    ];

    const result = strokesToJson(strokes);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].isEraser).toBeUndefined();
    expect(parsed[1].isEraser).toBe(true);
    expect(parsed[2].isEraser).toBe(false);
  });

  it("should preserve point precision", () => {
    const strokes: Stroke[] = [
      {
        points: [[1.123456789, 2.987654321], [3.14159265, 2.71828182]],
        color: "black",
        size: 3,
      },
    ];

    const result = strokesToJson(strokes);
    const parsed = JSON.parse(result);

    expect(parsed[0].points[0][0]).toBe(1.123456789);
    expect(parsed[0].points[0][1]).toBe(2.987654321);
  });
});

describe("jsonToStrokes", () => {
  it("should parse empty array", () => {
    const result = jsonToStrokes("[]");
    expect(result).toEqual([]);
  });

  it("should parse valid stroke data", () => {
    const json = JSON.stringify([
      { points: [[10, 20], [30, 40]], color: "black", size: 3 },
    ]);

    const result = jsonToStrokes(json);

    expect(result).toHaveLength(1);
    expect(result![0].points).toEqual([[10, 20], [30, 40]]);
  });

  it("should return null for invalid JSON", () => {
    expect(jsonToStrokes("not valid json")).toBeNull();
    expect(jsonToStrokes("{invalid}")).toBeNull();
    expect(jsonToStrokes("")).toBeNull();
  });

  it("should return null for non-array JSON", () => {
    expect(jsonToStrokes('{"key": "value"}')).toBeNull();
    expect(jsonToStrokes('"string"')).toBeNull();
    expect(jsonToStrokes("123")).toBeNull();
  });

  it("should handle legacy format by returning empty array", () => {
    // Legacy format from react-sketch-canvas (array of paths/strings)
    const legacyJson = JSON.stringify([
      { paths: "M 0 0 L 10 10", strokeWidth: 3 },
    ]);

    const result = jsonToStrokes(legacyJson);
    expect(result).toEqual([]);
  });

  it("should parse multi-page format", () => {
    const multiPageJson = JSON.stringify([
      { pageIndex: 0, points: [[0, 0], [10, 10]], color: "black", size: 3 },
      { pageIndex: 0, points: [[20, 20], [30, 30]], color: "black", size: 3 },
      { pageIndex: 1, points: [[5, 5], [15, 15]], color: "blue", size: 5 },
    ]);

    const result = jsonToStrokes(multiPageJson);

    expect(result).toHaveLength(3);
    expect((result![0] as any).pageIndex).toBe(0);
    expect((result![2] as any).pageIndex).toBe(1);
  });
});

describe("roundtrip serialization", () => {
  it("should preserve stroke data through serialization", () => {
    const original: Stroke[] = [
      { points: [[0, 0], [100, 100]], color: "hsl(15, 20%, 18%)", size: 3 },
      { points: [[50, 50], [75, 25], [100, 50]], color: "white", size: 24, isEraser: true },
    ];

    const json = strokesToJson(original);
    const restored = jsonToStrokes(json);

    expect(restored).toEqual(original);
  });

  it("should handle empty strokes roundtrip", () => {
    const original: Stroke[] = [];
    const json = strokesToJson(original);
    const restored = jsonToStrokes(json);
    expect(restored).toEqual([]);
  });

  it("should handle large stroke data", () => {
    // Simulate a complex drawing with many points
    const manyPoints: number[][] = [];
    for (let i = 0; i < 1000; i++) {
      manyPoints.push([Math.random() * 600, Math.random() * 500]);
    }

    const original: Stroke[] = [
      { points: manyPoints, color: "black", size: 3 },
    ];

    const json = strokesToJson(original);
    const restored = jsonToStrokes(json);

    expect(restored).toHaveLength(1);
    expect(restored![0].points).toHaveLength(1000);
  });
});
