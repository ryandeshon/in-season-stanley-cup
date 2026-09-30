import { DateTime } from 'luxon';

// Keep the result through the end of its Eastern calendar day, with at least
// two hours for late finishes. savedAt is the checker's committed final time.
export function postgameUntil(finalizedAt) {
  const final = DateTime.fromISO(finalizedAt || '', {
    zone: 'America/New_York',
  });
  if (!final.isValid) return 0;
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
