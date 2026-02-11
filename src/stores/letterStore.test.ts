import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useLetterStore, Letter } from "./letterStore";

describe("letterStore", () => {
  beforeEach(() => {
    // Reset the store to its initial state with mock data
    useLetterStore.setState({
      letters: [
        {
          id: "1",
          title: "Past delivery",
          body: "Already delivered",
          date: "2024-01-01",
          deliveryDate: "2024-01-15",
          signature: "Test",
          recipientType: "myself",
          photos: [],
          isTyped: true,
          createdAt: "2024-01-01T10:00:00Z",
          type: "sent",
        },
        {
          id: "2",
          title: "Future delivery",
          body: "Not yet delivered",
          date: "2024-01-01",
          deliveryDate: "2099-12-31",
          signature: "Test",
          recipientType: "myself",
          photos: [],
          isTyped: true,
          createdAt: "2024-01-01T10:00:00Z",
          type: "sent",
        },
      ],
    });
  });

  describe("getLetterById", () => {
    it("should return letter when found", () => {
      const letter = useLetterStore.getState().getLetterById("1");
      expect(letter).toBeDefined();
      expect(letter?.title).toBe("Past delivery");
    });

    it("should return undefined when not found", () => {
      const letter = useLetterStore.getState().getLetterById("nonexistent");
      expect(letter).toBeUndefined();
    });
  });

  describe("addLetter", () => {
    it("should add a new letter to the store", () => {
      const newLetter: Letter = {
        id: "3",
        title: "New Note",
        body: "New content",
        date: "2024-02-01",
        deliveryDate: "2024-03-01",
        signature: "New signature",
        recipientType: "someone",
        recipientEmail: "test@example.com",
        photos: ["photo1.jpg"],
        isTyped: true,
        createdAt: "2024-02-01T10:00:00Z",
        type: "sent",
      };

      useLetterStore.getState().addLetter(newLetter);
      const letters = useLetterStore.getState().letters;

      expect(letters).toHaveLength(3);
      expect(letters[2].id).toBe("3");
      expect(letters[2].title).toBe("New Note");
    });

    it("should add letter with sketch data", () => {
      const sketchLetter: Letter = {
        id: "4",
        title: "Sketch Note",
        body: "",
        date: "2024-02-01",
        deliveryDate: "2024-03-01",
        signature: "Signed",
        recipientType: "myself",
        photos: [],
        sketchData: '[{"points":[[0,0],[10,10]],"color":"black","size":3}]',
        isTyped: false,
        createdAt: "2024-02-01T10:00:00Z",
        type: "sent",
      };

      useLetterStore.getState().addLetter(sketchLetter);
      const letter = useLetterStore.getState().getLetterById("4");

      expect(letter).toBeDefined();
      expect(letter?.isTyped).toBe(false);
      expect(letter?.sketchData).toContain("points");
    });
  });

  describe("isLetterOpenable", () => {
    it("should return true for past delivery date", () => {
      const letter = useLetterStore.getState().getLetterById("1")!;
      const result = useLetterStore.getState().isLetterOpenable(letter);
      expect(result).toBe(true);
    });

    it("should return false for future delivery date", () => {
      const letter = useLetterStore.getState().getLetterById("2")!;
      const result = useLetterStore.getState().isLetterOpenable(letter);
      expect(result).toBe(false);
    });

    it("should return true for today's delivery date", () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      const todayLetter: Letter = {
        id: "today",
        title: "Today's Note",
        body: "Delivered today",
        date: todayStr,
        deliveryDate: todayStr,
        signature: "Test",
        recipientType: "myself",
        photos: [],
        isTyped: true,
        createdAt: todayStr + "T10:00:00Z",
        type: "sent",
      };

      useLetterStore.getState().addLetter(todayLetter);
      const letter = useLetterStore.getState().getLetterById("today")!;
      const result = useLetterStore.getState().isLetterOpenable(letter);

      expect(result).toBe(true);
    });

    it("should handle edge case at midnight", () => {
      // Letter delivered at exactly midnight today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      const midnightLetter: Letter = {
        id: "midnight",
        title: "Midnight Note",
        body: "Delivered at midnight",
        date: todayStr,
        deliveryDate: todayStr,
        signature: "Test",
        recipientType: "myself",
        photos: [],
        isTyped: true,
        createdAt: todayStr + "T00:00:00Z",
        type: "sent",
      };

      useLetterStore.getState().addLetter(midnightLetter);
      const letter = useLetterStore.getState().getLetterById("midnight")!;
      const result = useLetterStore.getState().isLetterOpenable(letter);

      expect(result).toBe(true);
    });
  });
});
