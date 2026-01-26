import { describe, it, expect, vi, beforeEach } from "vitest";
import { encryptValue, decryptValue, encryptLetterFields, decryptLetterFields } from "./encryption";

describe("encryption", () => {
  const testUserId = "test-user-123";

  describe("encryptValue", () => {
    it("should return empty string for empty input", async () => {
      const result = await encryptValue("", testUserId);
      expect(result).toBe("");
    });

    it("should encrypt a value with 'enc:' prefix", async () => {
      const result = await encryptValue("Hello World", testUserId);
      expect(result).toMatch(/^enc:/);
      expect(result).not.toContain("Hello World");
    });

    it("should produce different ciphertexts for same plaintext (random IV)", async () => {
      const result1 = await encryptValue("Same text", testUserId);
      const result2 = await encryptValue("Same text", testUserId);
      // Both should be encrypted but with different IVs
      expect(result1).toMatch(/^enc:/);
      expect(result2).toMatch(/^enc:/);
      expect(result1).not.toBe(result2);
    });
  });

  describe("decryptValue", () => {
    it("should return empty string for empty input", async () => {
      const result = await decryptValue("", testUserId);
      expect(result).toBe("");
    });

    it("should return unencrypted value as-is (legacy support)", async () => {
      const result = await decryptValue("Plain text without prefix", testUserId);
      expect(result).toBe("Plain text without prefix");
    });

    it("should decrypt encrypted values correctly", async () => {
      const original = "Secret message 🔐";
      const encrypted = await encryptValue(original, testUserId);
      const decrypted = await decryptValue(encrypted, testUserId);
      expect(decrypted).toBe(original);
    });

    it("should handle unicode and emojis", async () => {
      const original = "日本語テスト 🎉🚀💌";
      const encrypted = await encryptValue(original, testUserId);
      const decrypted = await decryptValue(encrypted, testUserId);
      expect(decrypted).toBe(original);
    });

    it("should handle large text", async () => {
      const original = "A".repeat(10000);
      const encrypted = await encryptValue(original, testUserId);
      const decrypted = await decryptValue(encrypted, testUserId);
      expect(decrypted).toBe(original);
    });

    it("should fail to decrypt with wrong user ID", async () => {
      const encrypted = await encryptValue("Secret", testUserId);
      const decrypted = await decryptValue(encrypted, "wrong-user-id");
      expect(decrypted).toBe("[Unable to decrypt]");
    });

    it("should handle corrupted data gracefully", async () => {
      const corrupted = "enc:invalid-base64-data!!!";
      const result = await decryptValue(corrupted, testUserId);
      expect(result).toBe("[Unable to decrypt]");
    });
  });

  describe("encryptLetterFields", () => {
    it("should encrypt all letter fields", async () => {
      const letter = {
        title: "My Letter",
        body: "Dear friend...",
        signature: "With love",
        sketchData: '[{"points":[[1,2]]}]',
      };

      const encrypted = await encryptLetterFields(letter, testUserId);

      expect(encrypted.title).toMatch(/^enc:/);
      expect(encrypted.body).toMatch(/^enc:/);
      expect(encrypted.signature).toMatch(/^enc:/);
      expect(encrypted.sketchData).toMatch(/^enc:/);
    });

    it("should handle null body", async () => {
      const letter = {
        title: "My Letter",
        body: null,
        signature: "With love",
      };

      const encrypted = await encryptLetterFields(letter, testUserId);

      expect(encrypted.title).toMatch(/^enc:/);
      expect(encrypted.body).toBeNull();
      expect(encrypted.signature).toMatch(/^enc:/);
    });

    it("should handle undefined sketchData", async () => {
      const letter = {
        title: "My Letter",
        body: "Content",
        signature: "With love",
        sketchData: undefined,
      };

      const encrypted = await encryptLetterFields(letter, testUserId);

      expect(encrypted.sketchData).toBeUndefined();
    });
  });

  describe("decryptLetterFields", () => {
    it("should decrypt all letter fields", async () => {
      const original = {
        title: "My Letter",
        body: "Dear friend...",
        signature: "With love",
        sketchData: '[{"points":[[1,2]]}]',
      };

      const encrypted = await encryptLetterFields(original, testUserId);
      const decrypted = await decryptLetterFields(encrypted, testUserId);

      expect(decrypted.title).toBe(original.title);
      expect(decrypted.body).toBe(original.body);
      expect(decrypted.signature).toBe(original.signature);
      expect(decrypted.sketchData).toBe(original.sketchData);
    });

    it("should preserve other properties during decryption", async () => {
      const original = {
        id: "letter-123",
        title: "My Letter",
        body: "Content",
        signature: "Signed",
        createdAt: "2024-01-01",
        extra: "data",
      };

      const encrypted = await encryptLetterFields(original, testUserId);
      const decrypted = await decryptLetterFields(
        { ...encrypted, id: original.id, createdAt: original.createdAt, extra: original.extra },
        testUserId
      );

      expect(decrypted.id).toBe("letter-123");
      expect(decrypted.createdAt).toBe("2024-01-01");
      expect(decrypted.extra).toBe("data");
    });

    it("should handle legacy unencrypted data", async () => {
      const legacyLetter = {
        title: "Old Letter",
        body: "Old content without encryption",
        signature: "Old signature",
      };

      const decrypted = await decryptLetterFields(legacyLetter, testUserId);

      expect(decrypted.title).toBe("Old Letter");
      expect(decrypted.body).toBe("Old content without encryption");
      expect(decrypted.signature).toBe("Old signature");
    });
  });

  describe("roundtrip encryption", () => {
    it("should handle complex letter data", async () => {
      const complexLetter = {
        title: "Complex Letter 📧",
        body: `Dear Future Me,

I hope this finds you well. Here are some thoughts:
- Remember to stay positive
- Keep learning new things
- Don't forget to rest

日本語も含まれています。

With love and hope ❤️`,
        signature: "Your past self ✨",
        sketchData: JSON.stringify([
          { points: [[0, 0], [100, 100], [200, 50]], color: "black", size: 3 },
          { points: [[50, 50], [150, 150]], color: "blue", size: 5 },
        ]),
      };

      const encrypted = await encryptLetterFields(complexLetter, testUserId);
      const decrypted = await decryptLetterFields(encrypted, testUserId);

      expect(decrypted.title).toBe(complexLetter.title);
      expect(decrypted.body).toBe(complexLetter.body);
      expect(decrypted.signature).toBe(complexLetter.signature);
      expect(decrypted.sketchData).toBe(complexLetter.sketchData);

      // Verify sketch data is valid JSON
      const parsedSketch = JSON.parse(decrypted.sketchData!);
      expect(parsedSketch).toHaveLength(2);
      expect(parsedSketch[0].points).toHaveLength(3);
    });
  });
});
