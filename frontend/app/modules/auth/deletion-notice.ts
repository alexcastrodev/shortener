import { notifications } from '@mantine/notifications';

export function announceRestore(response: { deletion_cancelled?: boolean }) {
  clearScheduledDeletion();
  if (!response.deletion_cancelled) return;
  notifications.show({
    color: 'green',
    title: 'Welcome back',
    autoClose: 12000,
    message: 'Your account was scheduled for deletion. Signing in cancelled it: your links, bio pages and forms are back online.',
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
