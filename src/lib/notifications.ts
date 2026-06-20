import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Minimal shape needed to schedule a reminder (satisfied by Race and LocalEvent). */
export interface Schedulable {
  date: string;
}

// Show reminders even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Schedules a local reminder ahead of the race start (24h before, falling back
 * to 1h before, then a near-immediate nudge for very soon / live races).
 * Returns the scheduled notification id, or null on web / failure.
 */
export async function scheduleRaceReminder(
  event: Schedulable,
  title: string,
  body: string,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const start = new Date(event.date).getTime();
  const now = Date.now();

  let triggerAt = start - 24 * 60 * 60 * 1000;
  if (triggerAt <= now) triggerAt = start - 60 * 60 * 1000;
  if (triggerAt <= now) triggerAt = now + 10 * 1000;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerAt),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}
