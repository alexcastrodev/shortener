export type FormEventName = 'view' | 'start';

export function trackFormEvent(publicId: string, event: FormEventName) {
  fetch(
    `${import.meta.env.VITE_BASE_URL}/api/public/forms/${encodeURIComponent(publicId)}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
      keepalive: true,
      credentials: 'omit',
    }
  ).catch(() => undefined);
}
