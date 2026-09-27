import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import StoryPage from '@/pages/StoryPage.vue';
let wrapper;
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('advances three timed scenes, pauses, ends at 30 seconds and replays', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('scrollY', 0);
  vi.stubGlobal(
    'scrollTo',
    vi.fn(({ top }) => {
      window.scrollY = top;
    })
  );
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
  wrapper = mount(StoryPage, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
  const button = (text) =>
    wrapper.findAll('button').find((b) => b.text().includes(text));
  expect(wrapper.findAll('.story-scene')).toHaveLength(1);
  await button('Play').trigger('click');
  expect(wrapper.findAll('.story-scene')).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(9900);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The seizure'
  );
  await vi.advanceTimersByTimeAsync(100);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The survivors'
  );
  await button('Pause').trigger('click');
  await vi.advanceTimersByTimeAsync(10000);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The survivors'
  );
  await button('Resume').trigger('click');
  await vi.advanceTimersByTimeAsync(10000);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The trap'
  );
  expect(Number(wrapper.find('input[type=range]').element.value)).toBeCloseTo(
    20
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The trap'
  );
  expect(wrapper.find('input[type=range]').element.value).toBe('30');
  await button('Replay').trigger('click');
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The seizure'
  );
  await button('Pause').trigger('click');
  await wrapper.find('input[type=range]').setValue('20');
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The trap'
  );
  expect(window.scrollTo).toHaveBeenCalled();
  // Return before the browser has delivered the programmatic seek's scroll event.
  window.scrollTo({ top: 0 });
  window.dispatchEvent(new Event('scroll'));
  await wrapper.vm.$nextTick();
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The seizure'
  );
});
