import { describe, it, expect } from 'vitest';
import { postgameUntil, recentFinalRecord } from '@/utilities/postgameWindow';
describe('postgame display window', () => {
  it('keeps an early finish through midnight Eastern', () => {
    expect(postgameUntil('2026-09-29T21:00:00-04:00')).toBe(
      Date.parse('2026-09-30T03:59:59.999Z')
    );
  });
  it('keeps a late finish for at least two hours across midnight', () => {
    expect(postgameUntil('2026-09-29T23:30:00-04:00')).toBe(
      Date.parse('2026-09-30T05:30:00Z')
    );
  });
  it('selects the latest committed final, rejecting expired, missing, and future dates', () => {
    const now = Date.parse('2026-09-30T00:00:00Z');
    const record = { id: 2, savedAt: '2026-09-29T23:00:00Z' };
    expect(
      recentFinalRecord(
        [
          { id: 1 },
          { id: 3, savedAt: '2026-10-01T00:00:00Z' },
          { id: 4, savedAt: '2026-09-28T00:00:00Z' },
          record,
        ],
        now
      )
    ).toEqual(record);
    expect(
      recentFinalRecord([record], Date.parse('2026-09-30T04:00:00Z'))
    ).toBeUndefined();
  });
});
