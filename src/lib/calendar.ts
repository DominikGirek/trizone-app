import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import type { Race } from '@/types';

async function getWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal?.id ?? null;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications) ?? calendars[0];
  return writable?.id ?? null;
}

/**
 * Adds a race to the device calendar. Returns true on success.
 * No-op on web (expo-calendar is native only).
 */
export async function addRaceToCalendar(race: Race): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return false;

    const calendarId = await getWritableCalendarId();
    if (!calendarId) return false;

    const start = new Date(race.date);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000); // assume ~3h

    await Calendar.createEventAsync(calendarId, {
      title: `🏁 ${race.name}`,
      startDate: start,
      endDate: end,
      location: race.location,
      notes: 'TriZone',
      timeZone: undefined,
    });
    return true;
  } catch {
    return false;
  }
}
