import { DateTime } from 'luxon';

// Display instants in the viewer's current device timezone, never the venue zone.
export function formatLocalTime(value, compact = false) {
  const date = DateTime.fromISO(value || '').setZone('system');
  if (!date.isValid) return '';
  return compact
    ? date.toFormat('MM/dd h:mm a ZZZZ')
    : date.toLocaleString(DateTime.DATETIME_FULL);
}

export function gameCountdown(value, now = Date.now()) {
  const start = Date.parse(value);
  if (!Number.isFinite(start)) return '';
  const seconds = Math.max(0, Math.ceil((start - now) / 1000));
  if (!seconds) return 'Faceoff pending';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `Faceoff in ${days ? `${days}d ` : ''}${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`;
}
