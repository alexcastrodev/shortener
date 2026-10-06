import type {
  NoticeChannel,
  NoticePreference,
} from '@internal/core/actions/get-notification-preferences/get-notification-preferences.types';

export const shownChannels = (pushAvailable: boolean): NoticeChannel[] =>
  pushAvailable ? ['in_app', 'email', 'push'] : ['in_app', 'email'];

export function eventsOf(preferences: NoticePreference[]) {
  return [...new Set(preferences.map(item => item.kind))];
}

export function cell(
  preferences: NoticePreference[],
  kind: string,
  channel: NoticeChannel
) {
  return preferences.find(
    item => item.kind === kind && item.channel === channel
  );
}

export function change(kind: string, channel: NoticeChannel, enabled: boolean) {
  return { preferences: [{ kind, channel, enabled }] };
}
