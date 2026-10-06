const TEXT = {
  en: {
    appointment_created: 'New booking',
    appointment_requested: 'A booking needs your approval',
    appointment_cancelled: 'A booking was cancelled',
    appointment_expired: 'A request expired',
    appointment_auto_confirmed: 'A request was confirmed automatically',
    fallback: 'New notice',
  },
  pt: {
    appointment_created: 'Nova marcação',
    appointment_requested: 'Uma marcação precisa da sua aprovação',
    appointment_cancelled: 'Uma marcação foi cancelada',
    appointment_expired: 'Um pedido expirou',
    appointment_auto_confirmed: 'Um pedido foi confirmado automaticamente',
    fallback: 'Novo aviso',
  },
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  const language = String(self.navigator.language || 'en').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  const texts = TEXT[language];

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some(client => client.visibilityState === 'visible' && client.focused)) return;
      await self.registration.showNotification('Kurz', {
        body: texts[data.kind] || texts.fallback,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: data.kind ? 'kurz-' + data.kind : 'kurz',
        data: { url: '/app/agenda' },
      });
    })()
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })()
  );
});
