import { notifications } from '@mantine/notifications';
import i18n from '../../i18n';

export function announceRestore(response: { deletion_cancelled?: boolean }) {
  clearScheduledDeletion();
  if (!response.deletion_cancelled) return;
  notifications.show({
    color: 'green',
    title: i18n.t('auth:welcome_back'),
    autoClose: 12000,
    message: i18n.t('auth:restored_message'),
  });
}

const KEY = 'kurz.deletion_due_at';

export function rememberScheduledDeletion(dueAt: string) {
  try {
    sessionStorage.setItem(KEY, dueAt);
  } catch {
    return;
  }
}

export function readScheduledDeletion(): Date | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) || date.getTime() < Date.now() ? null : date;
  } catch {
    return null;
  }
}

export function clearScheduledDeletion() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
}
