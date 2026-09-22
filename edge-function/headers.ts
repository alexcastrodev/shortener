// Public traffic reaches this function only through Cloudflare Tunnel, which
// sets cf-connecting-ip to the real client IP. X-Forwarded-For and X-Real-IP
// are client-controlled, so they are ignored. The socket address is only a
// fallback for local development, where there is no tunnel.
function extractIpAddress(req: Request, info: Deno.ServeHandlerInfo): string {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const addr = info.remoteAddr;
  return addr.transport === "tcp" || addr.transport === "udp" ? addr.hostname : "";
}

// cf-ipcountry is always sent by Cloudflare; cf-region only when the
// "Add visitor location headers" managed transform is enabled. Missing values
// are filled later by the backend's IpaddrJob.
export function extractLocation(headers: Headers) {
  const country = headers.get("cf-ipcountry")?.trim().toUpperCase();
  // XX = unknown location, T1 = Tor exit node
  const country_code = country && !["XX", "T1"].includes(country) ? country : null;
  const region = headers.get("cf-region")?.trim() || null;

  return { country_code, region };
}

// Order matters: Edge and Chrome on iOS also contain "Safari", and Edge on
// desktop also contains "Chrome", so the more specific tokens go first.
export function detectBrowser(user_agent: string): string {
  if (/Edg(e|A|iOS)?\//.test(user_agent)) return "Edge";
  if (/Firefox|FxiOS/.test(user_agent)) return "Firefox";
  if (/Chrome|CriOS/.test(user_agent)) return "Chrome";
  if (user_agent.includes("Safari")) return "Safari";
  return "Unknown";
}

// Android UAs contain "Linux" and iOS UAs contain "Mac OS X", so check the
// mobile platforms first.
export function detectPlatform(user_agent: string): string {
  if (/Android/i.test(user_agent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(user_agent)) return "iOS";
  if (user_agent.includes("Windows")) return "Windows";
  if (user_agent.includes("Mac OS")) return "macOS";
  if (user_agent.includes("Linux")) return "Linux";
  return "Unknown";
}

export function getHeaders(req: Request, info: Deno.ServeHandlerInfo) {
  const headers = req.headers;
  const user_agent = headers.get("user-agent") || "";
  const referer = headers.get("referer") || "";
  
  const ip_address = extractIpAddress(req, info);
  const browser = detectBrowser(user_agent);
  const platform = detectPlatform(user_agent);

  return {
    ...extractLocation(headers),
    browser,
    ip_address,
    platform,
    referer,
    user_agent,
  };
}