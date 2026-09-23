// Values under shortlink:<code> are written by Shortlink#save_cache in the
// Rails app as small JSON documents:
//   {"t":"url","v":"https://..."}  redirect to v
//   {"t":"locked"}                 password protected: send the visitor to
//                                  the frontend's /s/:code form
// Entries written before this format existed hold the raw URL; they are
// still honored so deploys of Rails and this function can happen in any
// order (run `rake shortlink:update_cache` to migrate them).
export type CacheAction =
  | { kind: "redirect"; url: string; track: boolean }
  | { kind: "not_found" };

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveCacheValue(
  value: string | null,
  shortCode: string,
  frontendUrl: string,
): CacheAction {
  if (!value) return { kind: "not_found" };

  let entry: unknown;
  try {
    entry = JSON.parse(value);
  } catch {
    // Legacy raw URL.
    return isHttpUrl(value)
      ? { kind: "redirect", url: value, track: true }
      : { kind: "not_found" };
  }

  if (typeof entry !== "object" || entry === null) return { kind: "not_found" };

  const { t, v } = entry as { t?: unknown; v?: unknown };
  switch (t) {
    case "url":
      return isHttpUrl(v)
        ? { kind: "redirect", url: v, track: true }
        : { kind: "not_found" };
    case "locked":
      // The click is recorded by the backend once the password is accepted.
      return {
        kind: "redirect",
        url: new URL(`/s/${encodeURIComponent(shortCode)}`, frontendUrl).href,
        track: false,
      };
    default:
      return { kind: "not_found" };
  }
}
