export function forwardVisitor(request?: Request): Record<string, string> {
  const secret = typeof process !== 'undefined' ? process.env.SSR_FORWARD_SECRET : undefined;
  const ip = request?.headers.get('cf-connecting-ip');
  if (!secret || !ip) return {};

  return { 'X-Visitor-Ip': ip, 'X-Ssr-Secret': secret };
}
