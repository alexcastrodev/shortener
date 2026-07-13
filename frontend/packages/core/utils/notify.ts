import { notifications } from '@mantine/notifications';

export function notifySuccess(message: string) {
  notifications.show({ message, color: 'green' });
}

export function notifyError(message: string, title = 'Error') {
  notifications.show({ title, message, color: 'red' });
}
