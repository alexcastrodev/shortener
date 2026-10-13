import { assertEquals, assertInstanceOf } from "@std/assert";
import { lookupShortlink, unavailableResponse } from "./lookup.ts";

const FRONTEND = "https://kurz.fyi";

Deno.test("a cached url is a redirect, read under the shortlink: key", async () => {
  let asked = "";
  const result = await lookupShortlink(
    (k) => {
      asked = k;
      return Promise.resolve('{"t":"url","v":"https://example.com/a"}');
    },
    "abc123",
    FRONTEND,
  );
  assertEquals(asked, "shortlink:abc123");
  assertEquals(result, { kind: "redirect", url: "https://example.com/a", track: true });
});

Deno.test("a missing key is a genuine not_found", async () => {
  assertEquals(
    await lookupShortlink(() => Promise.resolve(null), "nope", FRONTEND),
    { kind: "not_found" },
  );
});

Deno.test("a valkey error is unavailable, not not_found", async () => {
  const boom = new Error("connection refused");
  const result = await lookupShortlink(() => Promise.reject(boom), "abc123", FRONTEND);
  assertEquals(result, { kind: "unavailable", error: boom });
});

Deno.test("a hung valkey is unavailable once the timeout passes", async () => {
  const result = await lookupShortlink(() => new Promise(() => {}), "abc123", FRONTEND, 20);
  assertEquals(result.kind, "unavailable");
  assertInstanceOf((result as { error: unknown }).error, Error);
});

Deno.test("the unavailable response is a 503 with Retry-After and a body", async () => {
  const res = unavailableResponse();
  assertEquals(res.status, 503);
  assertEquals(res.headers.get("retry-after"), "5");
  assertEquals((await res.text()).length > 0, true);
});
