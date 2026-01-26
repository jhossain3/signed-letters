import { describe, it, expect } from "vitest";
import { 
  serializeStrokes, 
  deserializeStrokes, 
  serializeMultiPage, 
  deserializeMultiPage 
} from "./sketchSerialization";
import type { Stroke } from "@/components/sketch/FreehandCanvas";

describe("sketchSerialization", () => {
  describe("serializeStrokes", () => {
    it("should return empty array for empty strokes", () => {
      const result = serializeStrokes([]);
      expect(result).toBe("[]");
    });

    it("should serialize single stroke to compact format", () => {
      const strokes: Stroke[] = [{
        points: [[10, 20], [30, 40]],
        color: "hsl(15, 20%, 18%)",
        size: 3,
        isEraser: false,
      }];

      const result = serializeStrokes(strokes);
      const parsed = JSON.parse(result);

      // Format: [version, strokeCount, pointCount, size*100, colorIndex, isEraser, x1, y1, x2, y2]
      expect(parsed[0]).toBe(1); // version
      expect(parsed[1]).toBe(1); // stroke count
      expect(parsed[2]).toBe(2); // point count
      expect(parsed[3]).toBe(300); // size * 100
      expect(parsed[4]).toBe(0); // color index (ink)
      expect(parsed[5]).toBe(0); // isEraser
    });

    it("should handle eraser strokes", () => {
      const strokes: Stroke[] = [{
        points: [[0, 0]],
        color: "hsl(38, 35%, 97%)",
        size: 24,
        isEraser: true,
      }];

      const result = serializeStrokes(strokes);
      const parsed = JSON.parse(result);

      expect(parsed[4]).toBe(4); // paper color index
      expect(parsed[5]).toBe(1); // isEraser = true
    });

    it("should round points to 1 decimal place", () => {
      const strokes: Stroke[] = [{
        points: [[10.123456, 20.987654]],
        color: "hsl(15, 20%, 18%)",
        size: 3,
        isEraser: false,
      }];

      const result = serializeStrokes(strokes);
      const parsed = JSON.parse(result);

      // Points start at index 6
      expect(parsed[6]).toBe(10.1);
      expect(parsed[7]).toBe(21.0);
    });
  });

  describe("deserializeStrokes", () => {
    it("should return empty array for empty input", () => {
      const result = deserializeStrokes("[]");
      expect(result).toEqual([]);
    });

    it("should deserialize compact format back to strokes", () => {
      const original: Stroke[] = [{
        points: [[10, 20], [30, 40], [50, 60]],
        color: "hsl(15, 20%, 18%)",
        size: 3,
        isEraser: false,
      }];

      const serialized = serializeStrokes(original);
      const result = deserializeStrokes(serialized);

      expect(result).toHaveLength(1);
      expect(result![0].points).toHaveLength(3);
      expect(result![0].color).toBe("hsl(15, 20%, 18%)");
      expect(result![0].size).toBe(3);
      expect(result![0].isEraser).toBe(false);
    });

    it("should handle legacy Stroke[] format", () => {
      const legacyData = JSON.stringify([{
        points: [[0, 0], [10, 10]],
        color: "black",
        size: 5,
        isEraser: false,
      }]);

      const result = deserializeStrokes(legacyData);

      expect(result).toHaveLength(1);
      expect(result![0].points).toEqual([[0, 0], [10, 10]]);
    });

    it("should return null for unrecognized format", () => {
      const result = deserializeStrokes('{"invalid": "format"}');
      expect(result).toBeNull();
    });
  });

  describe("serializeMultiPage", () => {
    it("should serialize multiple pages to compact format", () => {
      const pages = [
        { pageIndex: 0, strokes: [{ points: [[0, 0]], color: "hsl(15, 20%, 18%)", size: 3, isEraser: false }] as Stroke[] },
        { pageIndex: 1, strokes: [{ points: [[10, 10]], color: "hsl(15, 20%, 18%)", size: 3, isEraser: false }] as Stroke[] },
      ];

      const result = serializeMultiPage(pages);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].p).toBe(0);
      expect(parsed[1].p).toBe(1);
      // Each page's data should be compact format
      expect(typeof parsed[0].d).toBe("string");
    });

    it("should skip empty pages", () => {
      const pages = [
        { pageIndex: 0, strokes: [{ points: [[0, 0]], color: "hsl(15, 20%, 18%)", size: 3, isEraser: false }] as Stroke[] },
        { pageIndex: 1, strokes: [] },
      ];

      const result = serializeMultiPage(pages);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].p).toBe(0);
    });
  });

  describe("deserializeMultiPage", () => {
    it("should deserialize new compact multi-page format", () => {
      const pages = [
        { pageIndex: 0, strokes: [{ points: [[0, 0], [5, 5]], color: "hsl(15, 20%, 18%)", size: 3, isEraser: false }] as Stroke[] },
      ];

      const serialized = serializeMultiPage(pages);
      const result = deserializeMultiPage(serialized);

      expect(result).toHaveLength(1);
      expect(result![0].pageIndex).toBe(0);
      expect(result![0].strokes).toHaveLength(1);
      expect(result![0].strokes[0].points).toHaveLength(2);
    });

    it("should handle legacy multi-page format", () => {
      const legacyData = JSON.stringify([
        { pageIndex: 0, strokes: [{ points: [[1, 2]], color: "black", size: 3 }] },
      ]);

      const result = deserializeMultiPage(legacyData);

      expect(result).toHaveLength(1);
      expect(result![0].pageIndex).toBe(0);
    });

    it("should handle legacy single-page Stroke[] format", () => {
      const legacyData = JSON.stringify([
        { points: [[0, 0]], color: "black", size: 3 },
      ]);

      const result = deserializeMultiPage(legacyData);

      expect(result).toHaveLength(1);
      expect(result![0].pageIndex).toBe(0);
      expect(result![0].strokes).toHaveLength(1);
    });

    it("should return empty array for empty input", () => {
      expect(deserializeMultiPage("[]")).toEqual([]);
      expect(deserializeMultiPage("")).toEqual([]);
    });
  });

  describe("roundtrip serialization", () => {
    it("should preserve stroke data through serialization roundtrip", () => {
      const original: Stroke[] = [
        { points: [[0, 0], [100, 100], [200, 50]], color: "hsl(358, 45%, 35%)", size: 5, isEraser: false },
        { points: [[50, 50], [75, 75]], color: "hsl(38, 35%, 97%)", size: 24, isEraser: true },
      ];

      const serialized = serializeStrokes(original);
      const deserialized = deserializeStrokes(serialized);

      expect(deserialized).toHaveLength(2);
      expect(deserialized![0].points).toHaveLength(3);
      expect(deserialized![0].color).toBe("hsl(358, 45%, 35%)");
      expect(deserialized![1].isEraser).toBe(true);
    });

    it("should be significantly smaller than JSON for complex drawings", () => {
      // Generate a realistic drawing with many points
      const strokes: Stroke[] = [];
      for (let s = 0; s < 10; s++) {
        const points: number[][] = [];
        for (let p = 0; p < 50; p++) {
          points.push([Math.random() * 600, Math.random() * 500]);
        }
        strokes.push({
          points,
          color: "hsl(15, 20%, 18%)",
          size: 3,
          isEraser: false,
        });
      }

      const jsonSize = JSON.stringify(strokes).length;
      const compactSize = serializeStrokes(strokes).length;

      // Compact format should be noticeably smaller
      expect(compactSize).toBeLessThan(jsonSize * 0.8);
    });
  });
});
