import { createPushSubscription } from '@internal/core/actions/create-push-subscription/create-push-subscription.service';
import { deletePushSubscription } from '@internal/core/actions/delete-push-subscription/delete-push-subscription.service';
import {
  bytesToUrlBase64,
  deviceState,
  urlBase64ToBytes,
  type DeviceState,
  type Permission,
} from './push-logic.ts';

const STORAGE_KEY = 'kurz-push-subscription';

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const isIos = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent);

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const readId = () => {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const writeId = (id: number | null) => {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Storage unavailable: the device simply will not remember its subscription.
  }
};

async function registration() {
  return navigator.serviceWorker.register('/sw.js');
}

export async function readDeviceState(
  serverEnabled: boolean
): Promise<DeviceState> {
  const can = supported();
  let subscribed = false;
  if (can) {
    const current = await navigator.serviceWorker.getRegistration('/sw.js');
    subscribed = Boolean(await current?.pushManager.getSubscription());
  }
  return deviceState({
    serverEnabled,
    supported: can,
    ios: isIos(),
    standalone: isStandalone(),
    permission: can ? (Notification.permission as Permission) : 'default',
    subscribed,
  });
}

export async function enableDevice(publicKey: string): Promise<DeviceState> {
  const worker = await registration();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    return permission === 'denied' ? 'denied' : 'off';

  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(publicKey) as BufferSource,
    }));
  const id = await createPushSubscription({
    endpoint: subscription.endpoint,
    p256dh: bytesToUrlBase64(subscription.getKey('p256dh')),
    auth: bytesToUrlBase64(subscription.getKey('auth')),
  });
  writeId(id);
  return 'on';
}

export async function disableDevice(): Promise<DeviceState> {
  const worker = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await worker?.pushManager.getSubscription();
  await subscription?.unsubscribe();
  const id = readId();
  if (id !== null) {
    await deletePushSubscription(id).catch(() => undefined);
    writeId(null);
  }
  return 'off';
}
