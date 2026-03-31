import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'daily-review-reminders';

export async function enableDailyReminder(hour: number) {
  const permissions = await Notifications.getPermissionsAsync();
  const granted =
    permissions.granted ||
    (await Notifications.requestPermissionsAsync()).granted;

  if (!granted) {
    throw new Error('Notification permission was not granted.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Daily Review Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to review',
      body: 'Your vocabulary queue is waiting for a quick study session.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      channelId: REMINDER_CHANNEL_ID,
      hour,
      minute: 0,
    },
  });
}

export async function disableDailyReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
