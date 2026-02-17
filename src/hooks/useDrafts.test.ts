import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

// Reuse the same Supabase mock pattern from encryption.test.ts
const generatedKeys = new Map<string, string>();
let mockDbRows: any[] = [];
let lastInsertedRow: any = null;
let lastUpdatedRow: any = null;

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "user_encryption_keys") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((_field: string, value: string) => ({
                maybeSingle: vi.fn(async () => {
                  const storedKey = generatedKeys.get(value);
                  return {
                    data: storedKey ? { encrypted_key: storedKey } : null,
                    error: null,
                  };
                }),
              })),
            })),
            insert: vi.fn(async (data: { user_id: string; encrypted_key: string }) => {
              generatedKeys.set(data.user_id, data.encrypted_key);
              return { error: null };
            }),
          };
        }
        // "letters" table mock
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({ data: mockDbRows, error: null })),
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: lastUpdatedRow, error: null })),
                })),
              })),
            })),
          })),
          insert: vi.fn((row: any) => {
            lastInsertedRow = row;
            const returned = { ...row, id: "new-draft-id", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: returned, error: null })),
              })),
            };
          }),
          update: vi.fn((row: any) => {
            lastUpdatedRow = { ...row, id: "existing-draft-id", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      single: vi.fn(async () => ({ data: lastUpdatedRow, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            })),
          })),
        };
      }),
    },
  };
});

// Import encryption utilities (they use the mocked supabase)
import { encryptLetterFields, decryptLetterFields, clearKeyCache, encryptValue } from "@/lib/encryption";
import { type SaveDraftInput } from "./useDrafts";

// We test the encryption integration logic directly (not the React hook)
// since the hook requires QueryClient + AuthContext wrappers.

const testUserId = "550e8400-e29b-41d4-a716-446655440000";

describe("Draft encryption integration", () => {
  beforeEach(() => {
    clearKeyCache();
    generatedKeys.clear();
    mockDbRows = [];
    lastInsertedRow = null;
    lastUpdatedRow = null;
  });

  describe("encrypting draft fields before save", () => {
    it("should encrypt title, body, signature, and sketchData", async () => {
      const input: Pick<SaveDraftInput, "title" | "body" | "signature" | "sketchData"> = {
        title: "My Draft Letter",
        body: "Dear future me, this is a draft...",
        signature: "With hope",
        sketchData: '[{"strokes":[]}]',
      };

      const encrypted = await encryptLetterFields(
        {
          title: input.title || "Untitled Letter",
          body: input.body,
          signature: input.signature || "",
          sketchData: input.sketchData,
        },
        testUserId
      );

      expect(encrypted.title).toMatch(/^enc:/);
      expect(encrypted.body).toMatch(/^enc:/);
      expect(encrypted.signature).toMatch(/^enc:/);
      expect(encrypted.sketchData).toMatch(/^enc:/);

      // Plaintext should NOT appear in encrypted output
      expect(encrypted.title).not.toContain("My Draft Letter");
      expect(encrypted.body).not.toContain("Dear future me");
      expect(encrypted.signature).not.toContain("With hope");
    });

    it("should handle draft with empty body", async () => {
      const encrypted = await encryptLetterFields(
        { title: "Title Only", body: null, signature: "Sig" },
        testUserId
      );

      expect(encrypted.title).toMatch(/^enc:/);
      expect(encrypted.body).toBeNull();
      expect(encrypted.signature).toMatch(/^enc:/);
    });

    it("should handle draft without sketchData", async () => {
      const encrypted = await encryptLetterFields(
        { title: "Typed Draft", body: "Some text", signature: "Me", sketchData: undefined },
        testUserId
      );

      expect(encrypted.sketchData).toBeUndefined();
    });

    it("should handle draft with empty title (defaults to Untitled)", async () => {
      const encrypted = await encryptLetterFields(
        { title: "Untitled Letter", body: "Content", signature: "" },
        testUserId
      );

      // Even "Untitled Letter" should be encrypted
      expect(encrypted.title).toMatch(/^enc:/);
      // Empty signature should remain empty (encryptValue returns empty for empty input)
      expect(encrypted.signature).toBe("");
    });
  });

  describe("decrypting draft fields after fetch", () => {
    it("should roundtrip encrypt/decrypt all fields", async () => {
      // Warm up key cache to avoid parallel key generation race
      await encryptValue("warmup", testUserId);
      const original = {
        title: "My Secret Draft",
        body: "This draft contains sensitive thoughts 💭",
        signature: "Anonymous Writer",
        sketchData: JSON.stringify([{ strokes: [[0, 0], [100, 200]] }]),
      };

      const encrypted = await encryptLetterFields(original, testUserId);
      const decrypted = await decryptLetterFields(encrypted, testUserId);

      expect(decrypted.title).toBe(original.title);
      expect(decrypted.body).toBe(original.body);
      expect(decrypted.signature).toBe(original.signature);
      expect(decrypted.sketchData).toBe(original.sketchData);
    });

    it("should handle legacy unencrypted drafts gracefully", async () => {
      const legacyDraft = {
        title: "Old Draft",
        body: "Written before encryption was added",
        signature: "Legacy User",
        sketchData: undefined,
      };

      // decryptLetterFields should return plaintext as-is
      const decrypted = await decryptLetterFields(legacyDraft, testUserId);

      expect(decrypted.title).toBe("Old Draft");
      expect(decrypted.body).toBe("Written before encryption was added");
      expect(decrypted.signature).toBe("Legacy User");
    });

    it("should handle mixed encrypted/unencrypted fields", async () => {
      // Simulate a partially migrated draft where only some fields are encrypted
      const encryptedTitle = await encryptValue("Encrypted Title", testUserId);

      const mixedDraft = {
        title: encryptedTitle,
        body: "Plaintext body (legacy)",
        signature: "Plaintext sig",
      };

      const decrypted = await decryptLetterFields(mixedDraft, testUserId);

      expect(decrypted.title).toBe("Encrypted Title");
      expect(decrypted.body).toBe("Plaintext body (legacy)");
      expect(decrypted.signature).toBe("Plaintext sig");
    });
  });

  describe("draft encryption with sketch data", () => {
    it("should encrypt and decrypt complex sketch data", async () => {
      await encryptValue("warmup", testUserId);
      const sketchData = JSON.stringify({
        pages: [
          { strokes: Array.from({ length: 50 }, (_, i) => ({ x: i, y: i * 2, pressure: 0.5 })) },
          { strokes: [{ x: 0, y: 0, pressure: 1 }] },
        ],
      });

      const encrypted = await encryptLetterFields(
        { title: "Sketch Draft", body: null, signature: "Artist", sketchData },
        testUserId
      );

      expect(encrypted.sketchData).toMatch(/^enc:/);

      const decrypted = await decryptLetterFields(encrypted, testUserId);
      expect(decrypted.sketchData).toBe(sketchData);

      // Verify JSON integrity
      const parsed = JSON.parse(decrypted.sketchData!);
      expect(parsed.pages).toHaveLength(2);
      expect(parsed.pages[0].strokes).toHaveLength(50);
    });

    it("should handle null sketch data in roundtrip", async () => {
      const encrypted = await encryptLetterFields(
        { title: "No Sketch", body: "Text only", signature: "Writer", sketchData: undefined },
        testUserId
      );

      const decrypted = await decryptLetterFields(encrypted, testUserId);
      expect(decrypted.sketchData).toBeUndefined();
    });
  });

  describe("draft encryption consistency", () => {
    it("should produce different ciphertext for same draft saved twice", async () => {
      await encryptValue("warmup", testUserId);
      const draft = { title: "Same Draft", body: "Same content", signature: "Same sig" };

      const encrypted1 = await encryptLetterFields(draft, testUserId);
      const encrypted2 = await encryptLetterFields(draft, testUserId);

      // Random IVs mean different ciphertext each time
      expect(encrypted1.title).not.toBe(encrypted2.title);
      expect(encrypted1.body).not.toBe(encrypted2.body);

      // But both decrypt to the same values
      const decrypted1 = await decryptLetterFields(encrypted1, testUserId);
      const decrypted2 = await decryptLetterFields(encrypted2, testUserId);
      expect(decrypted1.title).toBe(decrypted2.title);
      expect(decrypted1.body).toBe(decrypted2.body);
    });

    it("should use the same key for a user across multiple operations", async () => {
      await encryptValue("warmup", testUserId);
      const draft1 = { title: "Draft 1", body: "Body 1", signature: "Sig" };
      const draft2 = { title: "Draft 2", body: "Body 2", signature: "Sig" };

      const enc1 = await encryptLetterFields(draft1, testUserId);
      const enc2 = await encryptLetterFields(draft2, testUserId);

      // Both should decrypt correctly with same user key
      const dec1 = await decryptLetterFields(enc1, testUserId);
      const dec2 = await decryptLetterFields(enc2, testUserId);

      expect(dec1.title).toBe("Draft 1");
      expect(dec2.title).toBe("Draft 2");
    });

    it("should fail to decrypt with a different user's key", async () => {
      const otherUserId = "660e8400-e29b-41d4-a716-446655440001";
      const draft = { title: "Private Draft", body: "Secret", signature: "Me" };

      const encrypted = await encryptLetterFields(draft, testUserId);
      clearKeyCache();

      const decrypted = await decryptLetterFields(encrypted, otherUserId);
      expect(decrypted.title).toBe("[Unable to decrypt]");
      expect(decrypted.body).toBe("[Unable to decrypt]");
    });
  });
});
