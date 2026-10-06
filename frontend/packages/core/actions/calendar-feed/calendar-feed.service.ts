import { api } from '../api';

export type CalendarFeedState = {
  enabled: boolean;
  created_at?: string | null;
  last_fetched_at?: string | null;
};

export async function getCalendarFeed(): Promise<CalendarFeedState> {
  return (await api.get<CalendarFeedState>('/api/me/calendar_feed')).data;
}

export async function createCalendarFeed(): Promise<{ url: string }> {
  return (await api.post<{ url: string }>('/api/me/calendar_feed')).data;
}

export async function deleteCalendarFeed(): Promise<void> {
  await api.delete('/api/me/calendar_feed');
}
