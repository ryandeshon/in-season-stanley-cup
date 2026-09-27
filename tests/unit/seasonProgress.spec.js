import { describe, it, expect } from 'vitest';
import { seasonProgress } from '@/utilities/seasonProgress';
const season = {
  status: 'active',
  regularSeasonStart: '2026-09-29',
  regularSeasonEnd: '2027-04-10',
};
describe('season progress from NHL calendar dates', () => {
  it('shows zero before the opener, even with no game records', () => {
    expect(
      seasonProgress(season, Date.parse('2026-09-27T20:00:00Z'))
    ).toMatchObject({ percentage: 0, startLabel: '9/29', endLabel: '4/10' });
  });
  it('uses the end of the Eastern calendar day', () => {
    expect(
      seasonProgress(season, Date.parse('2027-04-11T02:00:00Z')).percentage
    ).toBeLessThan(100);
    expect(
      seasonProgress(season, Date.parse('2027-04-11T04:00:00Z'))
    ).toMatchObject({ percentage: 100, daysRemaining: 0 });
  });
  it('does not invent dates for missing or invalid metadata', () => {
    expect(seasonProgress({})).toBeNull();
    expect(
      seasonProgress({ ...season, regularSeasonEnd: '2026-01-01' })
    ).toBeNull();
  });
  it('shows archived seasons as complete', () => {
    expect(
      seasonProgress(
        { ...season, status: 'archived' },
        Date.parse('2026-10-01')
      )
    ).toMatchObject({ percentage: 100, daysRemaining: 0 });
  });
});
