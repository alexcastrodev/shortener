export interface AppNotification {
  id: number;
  kind: string;
  payload: {
    form_id?: number;
    response_id?: number;
    group_key?: string;
    sessions?: number;
  };
  recipient_kind: 'owner' | 'client';
  read_at: string | null;
  created_at: string;
}

export interface GetNotificationsResponse {
  notifications: AppNotification[];
  unread_count: number;
  next_before: number | null;
}
