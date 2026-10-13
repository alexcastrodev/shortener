import { type CacheAction, resolveCacheValue } from "./cache.ts";

export const VALKEY_TIMEOUT_MS = 2000;
export const RETRY_AFTER_SECONDS = 5;

export type Lookup = CacheAction | { kind: "unavailable"; error: unknown };

export async function lookupShortlink(
  get: (key: string) => Promise<string | null>,
  key: string,
  frontendUrl: string,
  timeoutMs = VALKEY_TIMEOUT_MS,
): Promise<Lookup> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`valkey get timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    const value = await Promise.race([get(`shortlink:${key}`), timeout]);
    return resolveCacheValue(value, key, frontendUrl);
  } catch (error) {
    return { kind: "unavailable", error };
  } finally {
    clearTimeout(timer);
  }
}

export function unavailableResponse(): Response {
  return new Response("Service temporarily unavailable. Please try again shortly.", {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "retry-after": String(RETRY_AFTER_SECONDS),
      "cache-control": "no-store",
    },
  });
}
