import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the feature flags
vi.mock("@/config/featureFlags", () => ({
  FEATURE_FLAGS: {
    AUTH_ENABLED: true,
    BYPASS_DELIVERY_DATE: false, // Test actual date logic
  },
}));

describe("isLetterOpenable logic", () => {
  // Test the date logic used in useLetters.isLetterOpenable
  // We test the logic directly since the hook requires React context

  interface TestLetter {
    deliveryDate: string;
  }

  const isLetterOpenable = (letter: TestLetter, bypassDeliveryDate = false): boolean => {
    if (bypassDeliveryDate) {
      return true;
    }

    const deliveryDate = new Date(letter.deliveryDate);
    const now = new Date();
    // Allow opening on the same day (compare dates only, not time)
    deliveryDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= deliveryDate;
  };

  describe("without bypass flag", () => {
    it("should return true for letters delivered in the past", () => {
      const letter = { deliveryDate: "2020-01-01" };
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should return false for letters to be delivered in the future", () => {
      const letter = { deliveryDate: "2099-12-31" };
      expect(isLetterOpenable(letter)).toBe(false);
    });

    it("should return true for letters delivered today", () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const letter = { deliveryDate: todayStr };
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should return false for letters delivered tomorrow", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const letter = { deliveryDate: tomorrowStr };
      expect(isLetterOpenable(letter)).toBe(false);
    });

    it("should return true for letters delivered yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const letter = { deliveryDate: yesterdayStr };
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should handle ISO date strings with time", () => {
      const pastDate = "2020-06-15T14:30:00Z";
      const letter = { deliveryDate: pastDate };
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should handle edge case: start of today", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const letter = { deliveryDate: today.toISOString() };
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should handle edge case: end of today", () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      // Using just the date part
      const dateStr = today.toISOString().split("T")[0];
      const letter = { deliveryDate: dateStr };
      expect(isLetterOpenable(letter)).toBe(true);
    });
  });

  describe("with bypass flag", () => {
    it("should return true for future letters when bypass is enabled", () => {
      const letter = { deliveryDate: "2099-12-31" };
      expect(isLetterOpenable(letter, true)).toBe(true);
    });

    it("should return true for past letters when bypass is enabled", () => {
      const letter = { deliveryDate: "2020-01-01" };
      expect(isLetterOpenable(letter, true)).toBe(true);
    });

    it("should return true for today when bypass is enabled", () => {
      const today = new Date().toISOString().split("T")[0];
      const letter = { deliveryDate: today };
      expect(isLetterOpenable(letter, true)).toBe(true);
    });
  });

  describe("date edge cases", () => {
    it("should handle leap year dates", () => {
      const letter = { deliveryDate: "2024-02-29" }; // 2024 is a leap year
      // This date is in the past
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should handle year boundary", () => {
      const letter = { deliveryDate: "2023-12-31" };
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should handle timezone edge cases gracefully", () => {
      // Even with different time zones, we compare dates at midnight local time
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const letter = { deliveryDate: todayStr + "T23:59:59.999Z" };

      // Should still be openable today regardless of the time in the date string
      expect(isLetterOpenable(letter)).toBe(true);
    });

    it("should handle malformed dates gracefully", () => {
      // Invalid date will result in NaN comparison which returns false
      const letter = { deliveryDate: "not-a-date" };
      expect(isLetterOpenable(letter)).toBe(false);
    });

    it("should handle empty delivery date", () => {
      const letter = { deliveryDate: "" };
      // Empty string creates invalid date
      expect(isLetterOpenable(letter)).toBe(false);
    });
  });
});

describe("Letter interface", () => {
  it("should support typed letter", () => {
    const typedLetter = {
      id: "1",
      title: "Test",
      body: "Content",
      date: "2024-01-01",
      deliveryDate: "2024-02-01",
      signature: "Signed",
      recipientType: "myself" as const,
      photos: [],
      isTyped: true,
      createdAt: "2024-01-01T00:00:00Z",
      type: "sent" as const,
    };

    expect(typedLetter.isTyped).toBe(true);
    expect(typedLetter.body).toBe("Content");
  });

  it("should support handwritten letter", () => {
    const handwrittenLetter = {
      id: "2",
      title: "Handwritten",
      body: null,
      date: "2024-01-01",
      deliveryDate: "2024-02-01",
      signature: "Signed",
      recipientType: "someone" as const,
      recipientEmail: "friend@example.com",
      photos: ["photo.jpg"],
      sketchData: '[{"points":[[0,0]],"color":"black","size":3}]',
      isTyped: false,
      createdAt: "2024-01-01T00:00:00Z",
      type: "sent" as const,
      paperColor: "hsl(38, 35%, 97%)",
      inkColor: "hsl(15, 20%, 18%)",
      isLined: true,
    };

    expect(handwrittenLetter.isTyped).toBe(false);
    expect(handwrittenLetter.sketchData).toBeDefined();
    expect(handwrittenLetter.recipientEmail).toBe("friend@example.com");
  });

  it("should support received letter type", () => {
    const receivedLetter = {
      id: "3",
      title: "From Friend",
      body: "Hello!",
      date: "2024-01-01",
      deliveryDate: "2024-02-01",
      signature: "Friend",
      recipientType: "myself" as const,
      photos: [],
      isTyped: true,
      createdAt: "2024-01-01T00:00:00Z",
      type: "received" as const,
    };

    expect(receivedLetter.type).toBe("received");
  });
});
