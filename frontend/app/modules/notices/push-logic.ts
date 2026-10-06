export type Permission = 'default' | 'granted' | 'denied';

export type DeviceState =
  'server_off' | 'ios_install' | 'unsupported' | 'denied' | 'on' | 'off';

export function deviceState(input: {
  serverEnabled: boolean;
  supported: boolean;
  ios: boolean;
  standalone: boolean;
  permission: Permission;
  subscribed: boolean;
}): DeviceState {
  if (!input.serverEnabled) return 'server_off';
  if (input.ios && !input.standalone) return 'ios_install';
  if (!input.supported) return 'unsupported';
  if (input.permission === 'denied') return 'denied';
  if (input.permission === 'granted' && input.subscribed) return 'on';
  return 'off';
}

export function urlBase64ToBytes(value: string) {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export function bytesToUrlBase64(bytes: ArrayBuffer | null) {
  if (!bytes) return '';
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
