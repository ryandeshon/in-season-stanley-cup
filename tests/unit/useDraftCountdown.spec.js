import { afterEach, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { mountComposable } from './helpers/mountComposable';
const tick = vi.hoisted(() => vi.fn());
vi.mock('@/composables/useArcadeSound', () => ({
  useArcadeSound: () => ({ play: tick, stop() {} }),
}));
import { useDraftCountdown } from '@/composables/useDraftCountdown';
afterEach(() => vi.useRealTimers());
it('counts down once per second, responds to lock state deadlines, and cleans up', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  const state = ref({
    draftStarted: true,
    autoPickEnabled: true,
    autoPickDeadlineAt: '2030-01-01T00:01:05Z',
  });
  const over = ref(false);
  const mounted = await mountComposable(() => useDraftCountdown(state, over));
  expect(mounted.result.autoPickCountdownLabel.value).toBe('01:05');
  await vi.advanceTimersByTimeAsync(65000);
  expect(mounted.result.autoPickSecondsRemaining.value).toBe(0);
  state.value = { ...state.value, isLocked: true, autoPickDeadlineAt: null };
  expect(mounted.result.showAutoPickCountdown.value).toBe(false);
  state.value = {
    ...state.value,
    isLocked: false,
    autoPickDeadlineAt: '2030-01-01T00:02:00Z',
  };
  expect(mounted.result.autoPickCountdownLabel.value).toBe('00:55');
  over.value = true;
  expect(mounted.result.showAutoPickCountdown.value).toBe(false);
  await mounted.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it('hides invalid and disabled deadlines', async () => {
  const state = ref({
    draftStarted: true,
    autoPickEnabled: true,
    autoPickDeadlineAt: 'invalid',
  });
  const mounted = await mountComposable(() =>
    useDraftCountdown(state, ref(false))
  );
  expect(mounted.result.autoPickCountdownLabel.value).toBe('--:--');
  state.value.autoPickEnabled = false;
  expect(mounted.result.autoPickSecondsRemaining.value).toBeNull();
  await mounted.unmount();
});

it('ticks only the last ten unlocked seconds, with urgent ticks for the final three', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  const state = ref({
    draftStarted: true,
    autoPickEnabled: true,
    autoPickDeadlineAt: '2030-01-01T00:00:11Z',
  });
  const mounted = await mountComposable(() =>
    useDraftCountdown(state, ref(false), () => true)
  );
  await vi.advanceTimersByTimeAsync(11000);
  expect(tick.mock.calls.map(([name]) => name)).toEqual([
    ...Array(7).fill('tick'),
    ...Array(3).fill('tick2'),
  ]);
  tick.mockClear();
  state.value = {
    ...state.value,
    isLocked: true,
    autoPickDeadlineAt: '2030-01-01T00:00:20Z',
  };
  await vi.advanceTimersByTimeAsync(9000);
  expect(tick).not.toHaveBeenCalled();
  await mounted.unmount();
});
