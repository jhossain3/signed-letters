import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

// Mock Supabase client before importing encryption module
vi.mock('@/integrations/supabase/client', () => {
  // Store generated keys per user for test isolation
  const generatedKeys = new Map<string, string>();
  let lastQueriedUserId: string | undefined;
  
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((_field: string, value: string) => {
            lastQueriedUserId = value;
            return {
              maybeSingle: vi.fn(async () => {
                const storedKey = lastQueriedUserId ? generatedKeys.get(lastQueriedUserId) : undefined;
                return { 
                  data: storedKey ? { encrypted_key: storedKey } : null, 
                  error: null 
                };
              }),
            };
          }),
        })),
        insert: vi.fn(async (data: { user_id: string; encrypted_key: string }) => {
          generatedKeys.set(data.user_id, data.encrypted_key);
          return { error: null };
        }),
      })),
    },
    // Expose for test cleanup
    __testClearKeys: () => generatedKeys.clear(),
  };
});

// Import after mocking
import { encryptValue, decryptValue, encryptLetterFields, decryptLetterFields, clearKeyCache, initializeUserEncryptionKey } from "./encryption";

describe("encryption", () => {
  // Use UUID for userId (matches database schema)
  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testUserId2 = "660e8400-e29b-41d4-a716-446655440001";

  beforeEach(() => {
    clearKeyCache();
  });

  afterEach(() => {
    clearKeyCache();
  });

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

    it("should fail to decrypt with different user key", async () => {
      const encrypted = await encryptValue("Secret", testUserId);
      // Clear cache and switch to different user
      clearKeyCache();
      const decrypted = await decryptValue(encrypted, testUserId2);
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
    // ... keep existing code (lines 220-218 tests)

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

  describe("initializeUserEncryptionKey", () => {
    it("should return true on successful initialization", async () => {
      const result = await initializeUserEncryptionKey(testUserId);
      expect(result).toBe(true);
    });

    it("should cache key after initialization for instant access", async () => {
      await initializeUserEncryptionKey(testUserId);
      // Subsequent encrypt should succeed immediately (uses cached key)
      const encrypted = await encryptValue("Quick test", testUserId);
      expect(encrypted).toMatch(/^enc:/);
    });
  });

  describe("security guarantees", () => {
    it("should use AES-GCM with random IV (integrity built-in)", async () => {
      // AES-GCM provides both encryption and authentication (AEAD)
      // Tampering with ciphertext causes decryption to fail
      const encrypted = await encryptValue("Tamper test", testUserId);
      const rawB64 = encrypted.slice(4); // remove 'enc:'
      
      // Modify a character in the middle of the ciphertext
      const chars = rawB64.split('');
      const midIdx = Math.floor(chars.length / 2);
      chars[midIdx] = chars[midIdx] === 'A' ? 'B' : 'A';
      const tampered = 'enc:' + chars.join('');
      
      const result = await decryptValue(tampered, testUserId);
      expect(result).toBe("[Unable to decrypt]");
    });

    it("should base64 encode all encrypted output", async () => {
      const encrypted = await encryptValue("Base64 check", testUserId);
      const b64Part = encrypted.slice(4); // remove 'enc:'
      // Valid base64 should not throw
      expect(() => atob(b64Part)).not.toThrow();
    });

    it("should never produce the same ciphertext for repeated encryptions", async () => {
      const results = new Set<string>();
      for (let i = 0; i < 5; i++) {
        results.add(await encryptValue("Repeated", testUserId));
      }
      expect(results.size).toBe(5);
    });
  });

  describe("edge cases", () => {
    it("should handle single character encryption", async () => {
      const encrypted = await encryptValue("x", testUserId);
      const decrypted = await decryptValue(encrypted, testUserId);
      expect(decrypted).toBe("x");
    });

    it("should handle string with only whitespace", async () => {
      const encrypted = await encryptValue("   \n\t  ", testUserId);
      const decrypted = await decryptValue(encrypted, testUserId);
      expect(decrypted).toBe("   \n\t  ");
    });

    it("should handle very long sketch data (50,000+ chars)", async () => {
      const longSketch = JSON.stringify(
        Array.from({ length: 500 }, (_, i) => ({
          points: Array.from({ length: 20 }, (_, j) => [i * j, i + j]),
          color: "black",
          size: 2,
        }))
      );
      expect(longSketch.length).toBeGreaterThan(50000);
      const encrypted = await encryptValue(longSketch, testUserId);
      const decrypted = await decryptValue(encrypted, testUserId);
      expect(decrypted).toBe(longSketch);
    });

    it("should handle HTML-like content without issues", async () => {
      const html = '<script>alert("xss")</script><div class="test">Hello & goodbye</div>';
      const encrypted = await encryptValue(html, testUserId);
      const decrypted = await decryptValue(encrypted, testUserId);
      expect(decrypted).toBe(html);
    });
  });
});
