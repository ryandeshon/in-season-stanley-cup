import { DateTime } from 'luxon';

// NHL schedule dates use Eastern time, independent of the viewer's timezone.
export function seasonProgress(season, now = Date.now()) {
  const options = { zone: 'America/New_York' };
  const start = DateTime.fromISO(
    season?.regularSeasonStart || '',
    options
  ).startOf('day');
  const end = DateTime.fromISO(season?.regularSeasonEnd || '', options).endOf(
    'day'
  );
  if (!start.isValid || !end.isValid || end <= start) return null;
  const finished = season.status === 'archived' || now >= end.toMillis();
  return {
    percentage: finished
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((now - start.toMillis()) / (end.toMillis() - start.toMillis())) *
              100
          )
        ),
    daysRemaining: finished
      ? 0
      : Math.max(0, Math.ceil((end.toMillis() - now) / 86400000)),
    startLabel: start.toFormat('M/d'),
    endLabel: end.toFormat('M/d'),
  };
}
