import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

import cue0 from '@/assets/sounds/arcade/boz-attack.mp3';
import cue1 from '@/assets/sounds/arcade/cooper-attack.mp3';
import cue2 from '@/assets/sounds/arcade/fatality.mp3';
import cue3 from '@/assets/sounds/arcade/fight.mp3';
import cue4 from '@/assets/sounds/arcade/finish-him.mp3';
import cue5 from '@/assets/sounds/arcade/flawless-victory.mp3';
import cue6 from '@/assets/sounds/arcade/hurt1.mp3';
import cue7 from '@/assets/sounds/arcade/hurt2.mp3';
import cue8 from '@/assets/sounds/arcade/hurt3.mp3';
import cue9 from '@/assets/sounds/arcade/hurt4.mp3';
import cue10 from '@/assets/sounds/arcade/hurt5.mp3';
import cue11 from '@/assets/sounds/arcade/hurt6.mp3';
import cue12 from '@/assets/sounds/arcade/hurt7.mp3';
import cue13 from '@/assets/sounds/arcade/ryan-attack.mp3';
import cue14 from '@/assets/sounds/arcade/ryan-talk1.mp3';
import cue15 from '@/assets/sounds/arcade/ryan-talk2.mp3';
import cue16 from '@/assets/sounds/arcade/ryan-talk3.mp3';
import cue17 from '@/assets/sounds/arcade/select.mp3';
import cue18 from '@/assets/sounds/arcade/start.mp3';
import cue19 from '@/assets/sounds/arcade/terry-attack.mp3';
import cue20 from '@/assets/sounds/arcade/tick.mp3';
import cue21 from '@/assets/sounds/arcade/tick2.mp3';
const urls = {
  'boz-attack': cue0,
  'cooper-attack': cue1,
  fatality: cue2,
  fight: cue3,
  'finish-him': cue4,
  'flawless-victory': cue5,
  hurt1: cue6,
  hurt2: cue7,
  hurt3: cue8,
  hurt4: cue9,
  hurt5: cue10,
  hurt6: cue11,
  hurt7: cue12,
  'ryan-attack': cue13,
  'ryan-talk1': cue14,
  'ryan-talk2': cue15,
  'ryan-talk3': cue16,
  select: cue17,
  start: cue18,
  'terry-attack': cue19,
  tick: cue20,
  tick2: cue21,
};
export const soundEnabled = ref(true);
export const audioReady = ref(false);
let context;
const buffers = new Map();
const channels = new Set();
try {
  soundEnabled.value = localStorage.getItem('arcade-sound') !== 'off';
} catch {
  /* optional storage */
}
watch(soundEnabled, (enabled) => {
  try {
    localStorage.setItem('arcade-sound', enabled ? 'on' : 'off');
  } catch {
    /* optional storage */
  }
  if (!enabled) channels.forEach((channel) => channel.stop());
});
export async function unlockArcadeSound() {
  if (!soundEnabled.value) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    context ||= new AudioContext();
    await context.resume();
    audioReady.value = context.state === 'running';
    if (audioReady.value) Object.keys(urls).forEach((name) => bufferFor(name));
  } catch {
    audioReady.value = false;
  }
}
export const randomCue = (prefix, count) =>
  `${prefix}${1 + Math.floor(Math.random() * count)}`;
async function bufferFor(name) {
  if (!urls[name]) return null;
  if (!buffers.has(name)) {
    buffers.set(
      name,
      fetch(urls[name])
        .then((r) => {
          if (!r.ok) throw new Error('Audio unavailable');
          return r.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .catch(() => {
          buffers.delete(name);
          return null;
        })
    );
  }
  return buffers.get(name);
}
export function createSoundChannel() {
  let generation = 0;
  let disposed = false;
  const sources = new Set();
  const channel = {
    stop() {
      generation++;
      for (const source of sources) {
        source.stop();
        source.onended?.();
      }
      sources.clear();
    },
    async sequence(names) {
      if (disposed) return;
      const ticket = generation;
      for (const name of names) {
        if (
          ticket !== generation ||
          !soundEnabled.value ||
          !audioReady.value ||
          document.hidden
        )
          return;
        const buffer = await bufferFor(name);
        if (
          !buffer ||
          ticket !== generation ||
          !soundEnabled.value ||
          document.hidden
        )
          return;
        await new Promise((resolve) => {
          const source = context.createBufferSource();
          source.buffer = buffer;
          const gain = context.createGain();
          gain.gain.value = 0.65;
          source.connect(gain);
          gain.connect(context.destination);
          sources.add(source);
          source.onended = () => {
            sources.delete(source);
            source.disconnect();
            gain.disconnect();
            resolve();
          };
          source.start();
        });
      }
    },
    play(name) {
      return channel.sequence([name]);
    },
    dispose() {
      disposed = true;
      channel.stop();
      channels.delete(channel);
    },
  };
  channels.add(channel);
  return channel;
}
export function useArcadeSound() {
  const channel = createSoundChannel();
  const hide = () => {
    if (document.hidden) channel.stop();
  };
  onMounted(() => {
    document.addEventListener('pointerdown', unlockArcadeSound);
    document.addEventListener('keydown', unlockArcadeSound);
    document.addEventListener('visibilitychange', hide);
  });
  onBeforeUnmount(() => {
    channel.dispose();
    document.removeEventListener('pointerdown', unlockArcadeSound);
    document.removeEventListener('keydown', unlockArcadeSound);
    document.removeEventListener('visibilitychange', hide);
  });
  return channel;
}
