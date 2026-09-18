<template>
  <div
    ref="page"
    class="story-page"
    :style="{ '--story-top': `${stickyTop}px` }"
  >
    <div
      class="story-stage"
      :style="{ top: `${stickyTop}px`, '--story-top': `${stickyTop}px` }"
    >
      <section
        ref="consoleEl"
        class="story-console"
        aria-label="The Black Rink one-minute prologue"
      >
        <header>
          <span>IN-SEASON STANLEY CUP</span>
          <h1>The Black Rink</h1>
        </header>
        <nav aria-label="Prologue scenes">
          <button
            v-for="(scene, index) in scenes"
            :key="scene.title"
            :aria-pressed="active === index"
            @click="seek(index * 20)"
          >
            {{ ['I', 'II', 'III'][index] }} · {{ scene.title }}
          </button>
        </nav>
        <article class="br-frame story-scene" :aria-label="scene.title">
          <div class="br-picture">
            <img
              :src="scene.art"
              :alt="scene.alt"
              :style="{ transform: camera }"
            />
          </div>
          <div
            ref="copyEl"
            class="br-copy"
            tabindex="0"
            aria-label="Scene narration"
          >
            <p>{{ visibleCopy }}</p>
          </div>
        </article>
        <label class="br-progress">
          <span class="sr-only">Story position</span>
          <input
            type="range"
            min="0"
            max="60"
            step="0.1"
            :value="elapsed"
            :style="{ '--progress': `${(elapsed / 60) * 100}%` }"
            aria-label="Story time in seconds"
            @input="seek(Number($event.target.value))"
          />
        </label>
        <div class="br-controls">
          <button @click="togglePlay">
            {{
              playing
                ? 'Pause'
                : elapsed >= 60
                  ? 'Replay'
                  : hasPlayed
                    ? 'Resume'
                    : 'Play intro'
            }}</button
          ><button
            :disabled="visibleCopy === scene.copy"
            @click="fullText = true"
          >
            Full text</button
          ><output>{{ timecode }} / 01:00</output>
        </div>
        <footer>
          <span>Scroll through the story, or play the one-minute intro.</span
          ><span role="status">{{
            elapsed >= 60
              ? 'The gates are closed. The tournament awaits.'
              : `Scene ${active + 1} of 3`
          }}</span>
        </footer>
        <router-link class="skip-link" to="/">Skip to the arena ↗</router-link>
      </section>
    </div>
  </div>
</template>
<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from 'vue';
import seizure from '@/assets/arcade/seizure.png';
import survivors from '@/assets/arcade/survivors.png';
import trap from '@/assets/arcade/trap.png';
const scenes = [
  {
    title: 'The seizure',
    art: seizure,
    alt: 'Ryan grips the silver Cup above a rigged tactical board in his crimson arena.',
    copy: 'Ryan claimed the championship. Now he has seized the tournament itself. Bending its laws to his will, he stacks every contest against those who would challenge him. The Cup, once a symbol of honor, has become the seal of his tyranny.',
  },
  {
    title: 'The survivors',
    art: survivors,
    alt: 'Cooper stands with Boz and Terry among the ruins of the previous tournament.',
    copy: 'Only three warriors survived the previous tournament: Cooper, Boz, and Terry. Cooper, a former champion and steward of the Cup, has sworn to restore its honor. But Ryan has no intention of allowing his enemies another fair contest. He has prepared a darker arena.',
  },
  {
    title: 'The trap',
    art: trap,
    alt: 'Ryan invites the survivors into a black-ice arena as a portcullis closes.',
    copy: 'Lured by the promise of reclaiming the Cup, the survivors enter the Black Rink—Ryan’s realm, where his word is law and defeat means death. There, he intends to destroy his challengers with his own hands. The gates close. His final tournament begins.',
  },
];

const page = ref(null),
  consoleEl = ref(null),
  copyEl = ref(null),
  elapsed = ref(0),
  playing = ref(false),
  hasPlayed = ref(false),
  fullText = ref(false),
  reducedMotion = ref(false),
  stickyTop = ref(74);
const active = computed(() =>
  Math.min(2, Math.floor((elapsed.value + 0.00001) / 20))
);
const scene = computed(() => scenes[active.value]);
const fraction = computed(() => (elapsed.value - active.value * 20) / 20);
const camera = computed(() =>
  reducedMotion.value
    ? 'none'
    : `scale(${1.02 + fraction.value * 0.035}) translateX(${(fraction.value - 0.5) * (active.value === 1 ? -1.2 : 1.2)}%)`
);
const visibleCopy = computed(() =>
  playing.value && !fullText.value && !reducedMotion.value
    ? scene.value.copy.slice(0, Math.floor(fraction.value * 20 * 36))
    : scene.value.copy
);
const timecode = computed(() =>
  elapsed.value >= 60
    ? '01:00'
    : `00:${String(Math.floor(elapsed.value)).padStart(2, '0')}`
);
watch(active, () => {
  fullText.value = false;
  if (copyEl.value) copyEl.value.scrollTop = 0;
});
// Keep the newest typed line visible without changing the artwork's size.
watch(visibleCopy, async () => {
  await nextTick();
  if (copyEl.value && playing.value && !fullText.value) {
    copyEl.value.scrollTop = copyEl.value.scrollHeight;
  }
});
watch(fullText, () => {
  if (copyEl.value) copyEl.value.scrollTop = 0;
});
function startY() {
  return (
    page.value.getBoundingClientRect().top +
    window.scrollY +
    parseFloat(getComputedStyle(page.value).paddingTop || 0) -
    stickyTop.value
  );
}
function seek(time) {
  playing.value = false;
  elapsed.value = time;
  window.scrollTo({
    top: Math.max(0, startY() + (time / 60) * 2400),
    behavior: 'instant',
  });
}
let lastScrollY = 0;
function scrollStory() {
  if (Math.abs(window.scrollY - lastScrollY) < 2) return;
  lastScrollY = window.scrollY;
  playing.value = false;
  elapsed.value = Math.max(
    0,
    Math.min(60, ((window.scrollY - startY()) / 2400) * 60)
  );
}
function togglePlay() {
  hasPlayed.value = true;
  lastScrollY = window.scrollY;
  if (elapsed.value >= 60) elapsed.value = 0;
  playing.value = !playing.value;
  last = performance.now();
}
function pauseHidden() {
  if (document.hidden) playing.value = false;
}
function resize() {
  const navigation = document.querySelector('.v-app-bar');
  stickyTop.value = (navigation?.getBoundingClientRect().bottom || 64) + 10;
}
let timer, last, media, observer;
function motion() {
  reducedMotion.value = media.matches;
}
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion();
  media.addEventListener('change', motion);
  resize();
  if (window.ResizeObserver) {
    observer = new ResizeObserver(resize);
    const navigation = document.querySelector('.v-app-bar');
    if (navigation) observer.observe(navigation);
  }
  last = performance.now();
  timer = setInterval(() => {
    const now = performance.now();
    if (playing.value && !document.hidden) {
      elapsed.value = Math.min(60, elapsed.value + (now - last) / 1000);
      if (elapsed.value >= 60) playing.value = false;
    }
    last = now;
  }, 100);
  window.addEventListener('scroll', scrollStory, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', pauseHidden);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  observer?.disconnect();
  media?.removeEventListener('change', motion);
  window.removeEventListener('scroll', scrollStory);
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', pauseHidden);
});
</script>
<style scoped>
.story-page {
  --console-height: min(900px, calc(100dvh - var(--story-top, 74px) - 10px));
  --picture-height: clamp(
    90px,
    calc((100dvh - var(--story-top, 74px) - 270px) * 0.52),
    320px
  );
  --story-padding: 20px;
  position: relative;
  min-height: calc(2400px + var(--console-height) + var(--story-padding));
  padding: var(--story-padding) 12px 0;
  background: #09090c;
  color: #fff;
}
.story-stage {
  position: sticky;
  top: 74px;
}
.story-console {
  --stone: url('../assets/arcade/arcade-stone.png');
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto auto;
  height: var(--console-height);
  max-width: 780px;
  margin: auto;
  padding: 10px;
  background: #55565a var(--stone) repeat;
  background-size: 128px;
  border: 6px ridge #969797;
  box-shadow: inset 0 0 0 2px #222;
  color: #fff;
  font:
    10px/1.7 'Press Start 2P',
    monospace;
  text-shadow: 2px 2px #17171a;
  color-scheme: dark;
}
.story-console * {
  box-sizing: border-box;
}
.story-console header {
  text-align: center;
  padding: 2px 0 6px;
  color: #fff;
}
.story-console header span {
  font-size: 9px;
}
.story-console h1 {
  font:
    22px/1.4 'Press Start 2P',
    monospace !important;
  border: 0 !important;
  margin: 8px 0 !important;
  color: #fff !important;
}
.story-console nav {
  display: flex;
  gap: 8px;
  margin: 6px 0 12px;
}
.story-console button {
  font:
    9px/1.7 'Press Start 2P',
    monospace;
  text-transform: uppercase;
  border: 3px outset #a2a2a2;
  border-radius: 0;
  background: #505055 var(--stone);
  background-size: 128px;
  color: #fff;
  text-shadow: 2px 2px #111;
  box-shadow: 1px 1px #111;
  padding: 7px 9px;
  min-height: 40px;
  cursor: pointer;
}
.story-console nav button {
  flex: 1;
  min-height: 44px;
}
.story-console button:hover {
  background-image: linear-gradient(#ffffff18, #ffffff18), var(--stone);
}
.story-console button[aria-pressed='true'] {
  background: #282c25;
  border: 3px solid #85ed34;
  color: #c8ff80;
  text-shadow: 2px 2px #0b1704;
}
.story-console button:disabled {
  color: #ddd;
  cursor: default;
}
.story-console .br-frame {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #5b5b60 var(--stone);
  background-size: 128px;
  border: 8px ridge #a1a0a3;
  padding: 8px;
  box-shadow: 2px 3px #222;
}
.story-console .br-picture {
  position: relative;
  height: var(--picture-height);
  flex: 0 0 var(--picture-height);
  overflow: hidden;
  border: 4px inset #9b9b9f;
  background: #08090b;
}
.story-console .br-picture img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  padding: 3%;
  image-rendering: pixelated;
  transition: transform 0.1s linear;
}
.story-console .br-picture::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(transparent 0 3px, #00000013 3px 4px);
}
.story-console .br-copy {
  flex: 0 1 auto;
  min-height: 36px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: #15161a;
  border: 4px inset #9a999e;
  margin-top: 8px;
  padding: 10px;
}
.story-console .br-copy p {
  font:
    11px/1.9 'Press Start 2P',
    monospace;
  letter-spacing: 0;
  text-transform: uppercase;
  margin: 0;
  color: #fff !important;
  text-shadow: 2px 2px #101015;
  overflow-wrap: anywhere;
}
.story-console :focus-visible {
  outline: 2px solid #c8ff80;
  outline-offset: 2px;
}
.story-console .br-progress {
  display: block;
  margin-top: 8px;
}
.story-console .br-progress input {
  appearance: none;
  display: block;
  width: 100%;
  height: 28px;
  cursor: pointer;
  background: transparent;
}
.story-console input::-webkit-slider-runnable-track {
  height: 6px;
  background: linear-gradient(
    to right,
    #88e839 var(--progress),
    #252829 var(--progress)
  );
  border-bottom: 1px solid #aaa;
}
.story-console input::-moz-range-track {
  height: 6px;
  background: #252829;
}
.story-console input::-moz-range-progress {
  height: 6px;
  background: #88e839;
}
.story-console input::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 20px;
  margin-top: -7px;
  border: 2px solid #d7ffb1;
  border-radius: 0;
  background: #88e839;
}
.story-console input::-moz-range-thumb {
  width: 12px;
  height: 16px;
  border: 2px solid #d7ffb1;
  border-radius: 0;
  background: #88e839;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.story-console .br-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.story-console .br-controls button {
  font-size: 8px;
}
.story-console output {
  margin-left: auto;
  font-size: 9px;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.story-console footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 9px;
  color: #fff;
  margin-top: 8px;
}
.story-console .skip-link {
  display: inline-block;
  color: #fff;
  padding: 6px 0;
  font-size: 10px;
}
@media (max-width: 600px) {
  .story-page {
    --story-padding: 10px;
    padding-inline: 6px;
  }
  .story-console {
    padding: 9px;
    border-width: 4px;
  }
  .story-console h1 {
    font-size: 16px !important;
  }
  .story-console nav {
    gap: 5px;
  }
  .story-console nav button {
    font-size: 8px;
    padding: 6px 3px;
  }
  .story-console .br-frame {
    padding: 5px;
    border-width: 6px;
  }
  .story-console .br-picture {
    border-width: 3px;
  }
  .story-console .br-controls {
    gap: 6px;
  }
  .story-console .br-controls button {
    padding: 5px 7px;
  }
  .story-console footer {
    font-size: 8px;
  }
}
@media (max-height: 800px) {
  .story-console footer > span:first-child {
    display: none;
  }
  .story-console header {
    padding-bottom: 0;
  }
  .story-console h1 {
    font-size: 16px !important;
    margin: 4px 0 !important;
  }
  .story-console .br-copy p {
    font-size: 10px;
    line-height: 1.7;
  }
  .story-console .br-progress {
    margin-top: 6px;
  }
}
@media (max-height: 700px) {
  .story-console header > span {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .story-console img {
    transform: none !important;
    transition: none !important;
  }
}
</style>
