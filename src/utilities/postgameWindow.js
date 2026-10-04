import { DateTime } from 'luxon';

// Overnight finals expire at noon Eastern rather than lasting another full day.
// Evening finishes retain the midnight / two-hour window.
export function postgameUntil(finalizedAt) {
  const final = DateTime.fromISO(finalizedAt || '', {
    zone: 'America/New_York',
  });
  if (!final.isValid) return 0;
  if (final.hour < 12) {
    return final.startOf('day').set({ hour: 12 }).toMillis();
  }
  return Math.max(
    final.plus({ hours: 2 }).toMillis(),
    final.endOf('day').toMillis()
  );
}

export function recentFinalRecord(records = [], now = Date.now()) {
  return [...records]
    .filter((record) => {
      const saved = Date.parse(record.savedAt);
      return record.id && saved <= now && postgameUntil(record.savedAt) > now;
    })
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0];
}
