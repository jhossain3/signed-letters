import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";

// Extract and test the helper functions independently
function isEncryptedTitle(title: string): boolean {
  return title.startsWith('enc:');
}

function getSafeDisplayTitle(title: string, override?: string): string {
  if (override) return override;
  if (isEncryptedTitle(title)) return "A note is waiting for you";
  return title;
}

Deno.test("isEncryptedTitle detects enc: prefix", () => {
  assertEquals(isEncryptedTitle("enc:abc123base64data=="), true);
  assertEquals(isEncryptedTitle("enc:"), true);
  assertEquals(isEncryptedTitle("My lovely title"), false);
  assertEquals(isEncryptedTitle(""), false);
  assertEquals(isEncryptedTitle("encrypted but no prefix"), false);
  assertEquals(isEncryptedTitle("ENC:uppercase"), false); // case-sensitive
});

Deno.test("getSafeDisplayTitle returns override when provided", () => {
  assertEquals(
    getSafeDisplayTitle("enc:ciphertext", "My Plaintext Title"),
    "My Plaintext Title"
  );
});

Deno.test("getSafeDisplayTitle falls back for encrypted titles without override", () => {
  assertEquals(
    getSafeDisplayTitle("enc:abc123longciphertext=="),
    "A note is waiting for you"
  );
});

Deno.test("getSafeDisplayTitle passes through plaintext titles", () => {
  assertEquals(getSafeDisplayTitle("Birthday Wishes 🎂"), "Birthday Wishes 🎂");
  assertEquals(getSafeDisplayTitle("A note to my future self"), "A note to my future self");
});

Deno.test("getSafeDisplayTitle handles edge cases", () => {
  assertEquals(getSafeDisplayTitle(""), "");
  assertEquals(getSafeDisplayTitle("enc:"), "A note is waiting for you");
  // Override always wins, even for plaintext
  assertEquals(getSafeDisplayTitle("plaintext", "override"), "override");
});
