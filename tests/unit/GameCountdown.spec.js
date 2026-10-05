import { mount } from '@vue/test-utils';
import { Settings } from 'luxon';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GameCountdown from '@/components/GameCountdown.vue';
import { formatLocalTime, gameCountdown } from '@/utilities/localTime';

afterEach(() => {
  Settings.defaultZone = 'system';
  vi.useRealTimers();
});
describe('local game countdown', () => {
  it('ticks across days, changes game, and cleans up its timer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T00:00:00Z'));
    const wrapper = mount(GameCountdown, {
      props: { startTimeUTC: '2026-10-06T00:00:01Z' },
    });
    expect(wrapper.text()).toContain('Faceoff in 1d 0h 00m 01s');
    await vi.advanceTimersByTimeAsync(2000);
    expect(wrapper.text()).toContain('Faceoff in 23h 59m 59s');
    await wrapper.setProps({ startTimeUTC: '2026-10-05T00:00:01Z' });
    expect(wrapper.text()).toContain('Faceoff pending');
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('hides unavailable start times and never counts below zero', () => {
    expect(gameCountdown('invalid')).toBe('');
    expect(formatLocalTime('invalid')).toBe('');
    expect(
      gameCountdown('2026-01-01T00:00:00Z', Date.parse('2026-02-01T00:00:00Z'))
    ).toBe('Faceoff pending');
  });
  it('uses the system zone even if Luxon has a different default', () => {
    Settings.defaultZone = 'Asia/Tokyo';
    const value = '2026-10-06T00:00:00Z';
    const expected = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
    expect(formatLocalTime(value)).toContain(expected);
  });
});
