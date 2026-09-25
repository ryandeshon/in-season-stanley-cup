import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
  createSoundChannel,
  soundEnabled,
  audioReady,
  unlockArcadeSound,
  randomCue,
} from '@/composables/useArcadeSound';
let sources, channels;
beforeEach(async () => {
  sources = [];
  channels = [];
  soundEnabled.value = true;
  audioReady.value = false;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({ ok: true, arrayBuffer: async () => url }))
  );
  window.AudioContext = class {
    state = 'running';
    destination = {};
    resume = async () => {};
    decodeAudioData = async (url) => ({ url });
    createGain = () => ({ gain: {}, connect() {}, disconnect() {} });
    createBufferSource = () => {
      const source = {
        connect() {},
        disconnect() {},
        stop: vi.fn(),
        start: vi.fn(() => sources.push(source)),
      };
      return source;
    };
  };
  await unlockArcadeSound();
});
afterEach(() => {
  channels.forEach((c) => c.dispose());
  vi.unstubAllGlobals();
});
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function channel() {
  const c = createSoundChannel();
  channels.push(c);
  return c;
}
it('plays the attack before the selected hurt clip without overlap', async () => {
  const c = channel();
  c.sequence(['cooper-attack', 'hurt7']);
  await flush();
  expect(sources).toHaveLength(1);
  expect(sources[0].buffer.url).toContain('cooper-attack');
  sources[0].onended();
  await flush();
  expect(sources).toHaveLength(2);
  expect(sources[1].buffer.url).toContain('hurt7');
});
it('cancels pending clips when muted or disposed and skips hidden-tab audio', async () => {
  const c = channel();
  c.sequence(['ryan-attack', 'hurt1']);
  await flush();
  soundEnabled.value = false;
  await nextTick();
  await flush();
  expect(sources[0].stop).toHaveBeenCalled();
  expect(sources).toHaveLength(1);
  soundEnabled.value = true;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: true,
  });
  await c.play('fight');
  expect(sources).toHaveLength(1);
});
it('covers all seven hurt choices and three Ryan lines', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  expect(randomCue('hurt', 7)).toBe('hurt1');
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
  expect(randomCue('hurt', 7)).toBe('hurt7');
  expect(randomCue('ryan-talk', 3)).toBe('ryan-talk3');
});
