import { assertEquals } from "@std/assert";
import { detectBrowser, detectPlatform, extractLocation } from "./headers.ts";

const cases: Array<[string, string, string, string]> = [
  [
    "Chrome on Windows",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Chrome",
    "Windows",
  ],
  [
    "Edge on Windows",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    "Edge",
    "Windows",
  ],
  [
    "Safari on macOS",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Safari",
    "macOS",
  ],
  [
    "Firefox on Linux",
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Firefox",
    "Linux",
  ],
  [
    "Chrome on Android",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    "Chrome",
    "Android",
  ],
  [
    "Safari on iPhone",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Safari",
    "iOS",
  ],
  [
    "Chrome on iPhone",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
    "Chrome",
    "iOS",
  ],
  [
    "Firefox on iPad",
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
    "Firefox",
    "iOS",
  ],
  ["empty", "", "Unknown", "Unknown"],
];

for (const [name, ua, browser, platform] of cases) {
  Deno.test(`detects ${name}`, () => {
    assertEquals(detectBrowser(ua), browser);
    assertEquals(detectPlatform(ua), platform);
  });
}

Deno.test("reads country and region from Cloudflare headers", () => {
  const headers = new Headers({ "cf-ipcountry": "br", "cf-region": "Sao Paulo" });
  assertEquals(extractLocation(headers), { country_code: "BR", region: "Sao Paulo" });
});

Deno.test("treats unknown and Tor countries as missing", () => {
  for (const country of ["XX", "T1"]) {
    const headers = new Headers({ "cf-ipcountry": country });
    assertEquals(extractLocation(headers), { country_code: null, region: null });
  }
});

Deno.test("returns nulls without Cloudflare headers", () => {
  assertEquals(extractLocation(new Headers()), { country_code: null, region: null });
});
