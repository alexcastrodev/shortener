import type { NoticeChannel } from '../get-notification-preferences/get-notification-preferences.types';

export interface UpdateNotificationPreferencesParams {
  preferences: { kind: string; channel: NoticeChannel; enabled: boolean }[];
}
