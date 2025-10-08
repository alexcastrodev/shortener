async function getGeolocationFromAPI(ip: string): Promise<{ country_code: string; region: string }> {
  if (!ip) {
    return { country_code: "", region: "" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,countryCode,regionName`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { country_code: "", region: "" };
    }
    
    const data = await response.json();
    console.log("Geolocation data from API:", data);
    return {
      country_code: data.countryCode || "",
      region: data.regionName || "",
    };
  } catch {
    console.error("Failed to fetch geolocation data");
    return { country_code: "", region: "" };
  }
}

function getRemoteIpFromInfo(i: unknown): string | null {
  if (!i || typeof i !== "object") return null;
  const obj = i as Record<string, unknown>;

  if (obj.remoteAddr) {
    const ra = obj.remoteAddr;
    if (typeof ra === "string") return ra;
    if (ra && typeof ra === "object") {
      const rao = ra as Record<string, unknown>;
      if (typeof rao.hostname === "string") return rao.hostname;
      if (typeof rao.ip === "string") return rao.ip;
      if (typeof rao.address === "string") return rao.address;
    }
  }

  if (obj.connInfo && typeof obj.connInfo === "object") {
    const ci = obj.connInfo as Record<string, unknown>;
    const ra = ci.remoteAddr;
    if (typeof ra === "string") return ra;
    if (ra && typeof ra === "object") {
      const rao = ra as Record<string, unknown>;
      if (typeof rao.hostname === "string") return rao.hostname;
      if (typeof rao.ip === "string") return rao.ip;
    }
  }

  if (obj.client && typeof obj.client === "object") {
    const c = obj.client as Record<string, unknown>;
    if (typeof c.ip === "string") return c.ip;
    if (typeof c.hostname === "string") return c.hostname;
  }

  if (obj.request && typeof obj.request === "object") {
    const reqObj = obj.request as Record<string, unknown>;
    if (reqObj.conn && typeof reqObj.conn === "object") {
      const conn = reqObj.conn as Record<string, unknown>;
      const ra = conn.remoteAddr;
      if (typeof ra === "string") return ra;
      if (ra && typeof ra === "object") {
        const rao = ra as Record<string, unknown>;
        if (typeof rao.hostname === "string") return rao.hostname;
      }
    }
  }

  if (typeof obj.ip === "string") return obj.ip;
  if (typeof obj.hostname === "string") return obj.hostname;

  return null;
}

function getNestedString(obj: unknown, path: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return null;
    const asObj = cur as Record<string, unknown>;
    cur = asObj[key];
  }
  return typeof cur === "string" ? cur : null;
}

function extractIpAddress(req: Request, info: Deno.ServeHandlerInfo): string {
  const headers = req.headers;
  const forwarded_for = headers.get("x-forwarded-for") || "";
  
  const ipFromHeaders = 
    headers.get("cf-connecting-ip") || 
    forwarded_for.split(",")[0]?.trim() || 
    headers.get("x-real-ip") || 
    "";
  
  const ipFromInfo = 
    getRemoteIpFromInfo(info) || 
    getRemoteIpFromInfo((info as unknown as Record<string, unknown>).connInfo);
  
  return ipFromHeaders || ipFromInfo || "";
}

async function extractGeolocation(req: Request, info: Deno.ServeHandlerInfo, ip: string): Promise<{ country_code: string; region: string }> {
  const headers = req.headers;
  
  let country_code = 
    headers.get("cf-ipcountry") || 
    getNestedString(info, ["cf", "country"]) || 
    getNestedString(info, ["country"]) || 
    getNestedString(info, ["geo", "country"]) || 
    "";
  
  let region = 
    headers.get("cf-region") || 
    getNestedString(info, ["cf", "region"]) || 
    getNestedString(info, ["region"]) || 
    getNestedString(info, ["geo", "region"]) || 
    "";
  
  // If no geolocation data from headers/info, use external API
  if (!country_code && !region && ip) {
    const geo = await getGeolocationFromAPI(ip);
    country_code = geo.country_code;
    region = geo.region;
  }
  
  return { country_code, region };
}

function detectBrowser(user_agent: string): string {
  if (user_agent.includes("Chrome")) return "Chrome";
  if (user_agent.includes("Firefox")) return "Firefox";
  if (user_agent.includes("Safari") && !user_agent.includes("Chrome")) return "Safari";
  if (user_agent.includes("Edge")) return "Edge";
  return "Unknown";
}

function detectPlatform(user_agent: string): string {
  if (user_agent.includes("Windows")) return "Windows";
  if (user_agent.includes("Mac OS")) return "macOS";
  if (user_agent.includes("Linux")) return "Linux";
  if (/Android/i.test(user_agent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(user_agent)) return "iOS";
  return "Unknown";
}

export async function getHeaders(req: Request, info: Deno.ServeHandlerInfo) {
  const headers = req.headers;
  const user_agent = headers.get("user-agent") || "";
  const referer = headers.get("referer") || "";
  
  const ip_address = extractIpAddress(req, info);
  const { country_code, region } = await extractGeolocation(req, info, ip_address);
  const browser = detectBrowser(user_agent);
  const platform = detectPlatform(user_agent);

  return {
    browser,
    country_code,
    ip_address,
    platform,
    referer,
    region,
    user_agent,
  };
}