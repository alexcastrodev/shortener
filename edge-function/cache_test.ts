import { assertEquals } from "@std/assert";
import { resolveCacheValue } from "./cache.ts";

const FRONTEND = "https://kurz.fyi";

Deno.test("redirects and tracks a JSON url entry", () => {
  assertEquals(
    resolveCacheValue('{"t":"url","v":"https://example.com/a?b=1"}', "abc123", FRONTEND),
    { kind: "redirect", url: "https://example.com/a?b=1", track: true },
  );
});

Deno.test("keeps redirecting legacy raw URL entries exactly as before", () => {
  assertEquals(
    resolveCacheValue("https://example.com/legacy", "abc123", FRONTEND),
    { kind: "redirect", url: "https://example.com/legacy", track: true },
  );
});

Deno.test("sends locked links to the password page without tracking", () => {
  assertEquals(
    resolveCacheValue('{"t":"locked"}', "abc123", FRONTEND),
    { kind: "redirect", url: "https://kurz.fyi/s/abc123", track: false },
  );
});

Deno.test("escapes the short code in the password page URL", () => {
  assertEquals(
    resolveCacheValue('{"t":"locked"}', "a/../b", FRONTEND),
    { kind: "redirect", url: "https://kurz.fyi/s/a%2F..%2Fb", track: false },
  );
});

Deno.test("treats missing values as not found", () => {
  assertEquals(resolveCacheValue(null, "abc123", FRONTEND), { kind: "not_found" });
  assertEquals(resolveCacheValue("", "abc123", FRONTEND), { kind: "not_found" });
});

Deno.test("does not break on malformed or unknown entries", () => {
  for (
    const value of [
      "{not json",
      "null",
      "42",
      '"https://example.com"',
      "[]",
      '{"t":"paused"}',
      '{"t":"url"}',
      '{"t":"url","v":42}',
      '{"t":"url","v":"javascript:alert(1)"}',
      "javascript:alert(1)",
    ]
  ) {
    assertEquals(resolveCacheValue(value, "abc123", FRONTEND), { kind: "not_found" }, value);
  }
});
