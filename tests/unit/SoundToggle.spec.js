import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { expect, it, vi } from 'vitest';
vi.mock('@/composables/useArcadeSound', () => ({
  soundEnabled: ref(true),
  audioReady: ref(false),
  unlockArcadeSound: vi.fn(async () => {}),
}));
import {
  soundEnabled,
  audioReady,
  unlockArcadeSound,
} from '@/composables/useArcadeSound';
import SoundToggle from '@/components/arcade/SoundToggle.vue';
it('enables browser-locked audio on first click rather than muting it', async () => {
  soundEnabled.value = true;
  audioReady.value = false;
  const wrapper = mount(SoundToggle, { global: { stubs: { 'v-icon': true } } });
  expect(wrapper.attributes('aria-label')).toBe('Enable sound');
  const documentGesture = vi.fn();
  document.addEventListener('pointerdown', documentGesture);
  await wrapper.trigger('pointerdown');
  expect(documentGesture).not.toHaveBeenCalled();
  await wrapper.trigger('click');
  expect(soundEnabled.value).toBe(true);
  expect(unlockArcadeSound).toHaveBeenCalled();
  audioReady.value = true;
  await wrapper.vm.$nextTick();
  expect(wrapper.attributes('aria-label')).toBe('Mute sound');
  await wrapper.trigger('click');
  expect(soundEnabled.value).toBe(false);
  document.removeEventListener('pointerdown', documentGesture);
  wrapper.unmount();
});
