export type NoticeChannel = 'in_app' | 'email' | 'push';

export interface NoticePreference {
  kind: string;
  channel: NoticeChannel;
  supported: boolean;
  enabled: boolean;
}

export interface GetNotificationPreferencesResponse {
  preferences: NoticePreference[];
}
