import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import StoryPage from '@/pages/StoryPage.vue';
let wrapper;
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('advances three timed scenes, pauses, ends at one minute and replays', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('scrollTo', vi.fn());
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
  await vi.advanceTimersByTimeAsync(20000);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The survivors'
  );
  await button('Pause').trigger('click');
  await vi.advanceTimersByTimeAsync(20000);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The survivors'
  );
  await button('Resume').trigger('click');
  await vi.advanceTimersByTimeAsync(40000);
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The trap'
  );
  expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe(
    '60'
  );
  await button('Replay').trigger('click');
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The seizure'
  );
  await button('Pause').trigger('click');
  await wrapper.find('input[type=range]').setValue('40');
  expect(wrapper.find('.story-scene').attributes('aria-label')).toBe(
    'The trap'
  );
  expect(window.scrollTo).toHaveBeenCalled();
});
