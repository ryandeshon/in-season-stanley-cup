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
        <div
          class="br-progress"
          role="progressbar"
          aria-label="Story progress"
          :aria-valuenow="Math.floor(elapsed)"
          aria-valuemin="0"
          aria-valuemax="60"
        >
          <span :style="{ width: `${(elapsed / 60) * 100}%` }"></span>
        </div>
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
        <label class="br-scrub"
          >Story position<input
            type="range"
            min="0"
            max="60"
            step="0.1"
            :value="elapsed"
            aria-label="Story time in seconds"
            @input="seek(Number($event.target.value))"
        /></label>
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
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
.story-console {
  background: #0c0d10;
  color: #f3efe5;
  padding: 18px;
  max-width: 960px;
  margin: auto;
  box-sizing: border-box;
  font:
    14px/1.5 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
  color-scheme: dark;
}
.story-console * {
  box-sizing: border-box;
}
.story-console header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  color: #d3b58b;
  letter-spacing: 0.13em;
  font-size: 11px;
  padding-bottom: 12px;
  border-bottom: 1px solid #414149;
}
.story-console nav {
  display: flex;
  gap: 6px;
  margin: 12px 0;
}
.story-console button {
  font: inherit;
  background: #24252d;
  border: 1px solid #5a5961;
  color: #efede6;
  padding: 9px 12px;
  cursor: pointer;
  min-height: 42px;
}
.story-console nav button {
  flex: 1;
  font-size: 12px;
}
.story-console button:hover {
  background: #3b3941;
}
.story-console button[aria-pressed='true'] {
  background: #d1b080;
  color: #151315;
  border-color: #d1b080;
}
.story-console .br-frame {
  border: 7px ridge #676770;
  padding: 7px;
  background: #35363f;
}
.story-console .br-picture {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: #09090c;
  border: 2px solid #15151a;
}
.story-console img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  display: block;
}
.story-console .br-copy {
  background: #20212a;
  border: 3px inset #6b6a73;
  margin-top: 8px;
  padding: 17px 21px;
  min-height: 154px;
}
.story-console .br-copy p {
  font-size: 14px;
  line-height: 1.65;
  letter-spacing: 0.035em;
  text-transform: uppercase;
  margin: 0;
  font-weight: 500;
  color: #faf7ef;
}
.story-console .br-progress {
  height: 3px;
  background: #37343d;
  margin-top: 10px;
}
.story-console .br-progress span {
  display: block;
  height: 100%;
  background: #d6b581;
  width: 0;
}
.story-console .br-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 12px;
}
.story-console .br-controls button {
  font-size: 12px;
}
.story-console output {
  margin-left: auto;
  font-size: 12px;
  color: #d5c4af;
  font-variant-numeric: tabular-nums;
}
.story-console .br-scrub {
  display: block;
  font-size: 11px;
  color: #c1bbc1;
  margin-top: 10px;
}
.story-console input {
  display: block;
  width: 100%;
  accent-color: #d1b080;
}
.story-console footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #bdb7c0;
  margin-top: 8px;
}
.story-console .br-wire {
  position: absolute;
  inset: 12%;
  background: #17191be8;
  border: 1px dashed #cbc7bf;
  padding: 20px;
  text-align: center;
  align-content: center;
  color: #e8dfd1;
}
.story-console .br-wire span {
  color: #dfbe8d;
}
.story-console .br-wire p {
  font-size: 12px;
}
.story-console.is-wire img {
  filter: grayscale(1);
  opacity: 0.3;
}
@media (max-width: 600px) {
  .story-console {
    padding: 10px;
  }
  .story-console header {
    font-size: 10px;
  }
  .story-console nav button {
    font-size: 10px;
    padding: 8px 4px;
  }
  .story-console .br-copy {
    padding: 12px;
    min-height: 238px;
  }
  .story-console .br-copy p {
    font-size: 12px;
    line-height: 1.6;
  }
  .story-console .br-controls {
    gap: 5px;
  }
  .story-console .br-controls button {
    font-size: 11px;
    padding: 7px;
  }
  .story-console .br-wire {
    inset: 5%;
    padding: 8px;
    font-size: 11px;
  }
  .story-console .br-wire p {
    font-size: 10px;
  }
  .story-console .br-frame {
    padding: 4px;
    border-width: 5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .story-console img {
    transform: none !important;
  }
}

.story-console {
  --stone: url('../assets/arcade/arcade-stone.png');
  background: #55565a var(--stone) repeat;
  background-size: 128px 128px;
  border: 6px ridge #969797;
  box-shadow: inset 0 0 0 2px #222;
  max-width: 880px;
  color: #fff;
  font-family: 'Press Start 2P', monospace;
  text-shadow: 2px 2px 0 #17171a;
  padding: 16px;
}
.story-console header {
  display: block;
  text-align: center;
  border: 0;
  padding: 2px 0 10px;
  font-family: 'Press Start 2P', monospace;
  letter-spacing: 0;
  font-size: 9px;
  line-height: 1.7;
  color: #eee;
}
.story-console header span {
  display: block;
}
.story-console header span + span {
  font-size: 22px;
  line-height: 1.4;
  color: #e7e7e7;
  text-shadow:
    2px 2px #111,
    3px 3px #222;
  margin-top: 7px;
}
.story-console nav {
  gap: 8px;
  margin: 6px 0 12px;
}
.story-console button {
  font-family: 'Press Start 2P', monospace;
  text-transform: uppercase;
  border: 3px outset #a2a2a2;
  border-radius: 0;
  background: #505055 var(--stone);
  background-size: 128px;
  color: #fff;
  text-shadow: 2px 2px #111;
  box-shadow: 1px 1px #111;
  font-size: 9px;
  line-height: 1.7;
  padding: 7px 9px;
  min-height: 40px;
}
.story-console nav button {
  font-size: 9px;
}
.story-console button:hover {
  background-image: linear-gradient(#ffffff18, #ffffff18), var(--stone);
  color: #fff;
}
.story-console button[aria-pressed='true'] {
  background: #282c25;
  border: 3px solid #85ed34;
  box-shadow: inset 0 0 0 2px #10170d;
  color: #c8ff80;
  text-shadow: 2px 2px #0b1704;
}
.story-console .br-frame {
  background: #5b5b60 var(--stone);
  background-size: 128px;
  border: 8px ridge #a1a0a3;
  padding: 8px;
  box-shadow: 2px 3px #222;
}
.story-console .br-picture {
  border: 4px inset #9b9b9f;
  background: #141418;
}
.story-console .br-picture:after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 3px,
    #00000013 3px,
    #00000013 4px
  );
}
.story-console .br-copy {
  background: linear-gradient(#15161adb, #15161adb), var(--stone);
  border: 4px inset #9a999e;
  padding: 16px 18px;
  min-height: 182px;
}
.story-console .br-copy p {
  font-family: 'Press Start 2P', monospace;
  font-size: 11px;
  line-height: 1.9;
  letter-spacing: 0;
  font-weight: 400;
  color: #fff;
  text-shadow: 2px 2px #101015;
}
.story-console .br-controls button {
  font-size: 8px;
}
.story-console output {
  font-size: 9px;
  color: #fff;
  line-height: 1.8;
}
.story-console .br-scrub,
.story-console footer {
  font-size: 9px;
  line-height: 1.7;
  color: #fff;
  letter-spacing: 0;
}
.story-console .br-progress {
  height: 5px;
  background: #262829;
  border-bottom: 1px solid #999;
}
.story-console .br-progress span {
  background: #88e839;
}
.story-console input {
  accent-color: #9ff450;
}
.story-console button:disabled {
  opacity: 0.65;
  cursor: default;
}
.story-console .br-wire {
  font-family: 'Press Start 2P', monospace;
  font-size: 11px;
  line-height: 1.8;
}
.story-console .br-wire p {
  font-size: 10px;
}
@media (max-width: 600px) {
  .story-console {
    padding: 9px;
    border-width: 4px;
  }
  .story-console header span + span {
    font-size: 16px;
  }
  .story-console nav {
    gap: 5px;
  }
  .story-console nav button {
    font-size: 8px;
    padding: 6px 3px;
    line-height: 1.7;
  }
  .story-console .br-frame {
    padding: 5px;
    border-width: 6px;
  }
  .story-console .br-picture {
    border-width: 3px;
  }
  .story-console .br-copy {
    padding: 12px 10px;
    min-height: 298px;
  }
  .story-console .br-copy p {
    font-size: 11px;
    line-height: 1.8;
  }
  .story-console .br-controls button {
    font-size: 8px;
    padding: 5px 7px;
  }
  .story-console footer {
    font-size: 8px;
  }
  .story-console .br-wire {
    inset: 4%;
    font-size: 9px;
  }
  .story-console .br-wire p {
    font-size: 8px;
  }
  .story-console .br-controls {
    gap: 6px;
  }
}

@media (min-width: 650px) {
  .story-console {
    max-width: 780px;
  }
  .story-console .br-picture {
    max-height: 36vh;
    aspect-ratio: auto;
    height: 320px;
  }
  .story-console img {
    object-fit: contain;
    background: #08090b;
  }
  .story-console .br-copy {
    min-height: 182px;
  }
}
@media (max-height: 700px) {
  .story-console .br-picture {
    max-height: 28vh;
  }
  .story-console header {
    padding-bottom: 7px;
  }
  .story-console nav {
    margin: 7px 0;
  }
}
.story-page {
  position: relative;
  background: #09090c;
  color: #fff;
  --console-height: min(900px, calc(100dvh - var(--story-top, 74px) - 10px));
  --story-padding: 20px;
  min-height: calc(2400px + var(--console-height) + var(--story-padding));
  padding: 20px 12px 0;
}
.story-stage {
  position: sticky;
  top: 74px;
}
.story-console h1 {
  font: inherit !important;
  font-size: 22px !important;
  line-height: 1.4 !important;
  border: 0 !important;
  margin: 8px 0 !important;
  color: #eee !important;
}
.story-console .br-picture img {
  transition: transform 0.1s linear;
}
.story-console .br-copy p {
  margin: 0;
  color: #fff;
}
.story-console .skip-link {
  display: inline-block;
  color: #fff;
  padding: 12px 0;
  font-size: 10px;
}
.story-console .br-scrub input {
  min-height: 32px;
}
.story-console nav button {
  min-height: 44px;
}
.story-console .br-copy {
  min-height: 182px;
}
@media (max-width: 600px) {
  .story-page {
    --story-padding: 10px;
    padding: 10px 6px 0;
  }
  .story-console h1 {
    font-size: 16px !important;
  }
  .story-console .br-copy {
    min-height: 298px;
  }
}
/* Keep the image and controls inside the viewport while the story is pinned. */
.story-console {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto auto auto;
  height: var(--console-height);
  padding: 10px;
}
.story-console .br-frame {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
}
.story-console .br-picture {
  height: 100%;
  max-height: none;
  min-height: 0;
  aspect-ratio: auto;
}
.story-console .br-picture img {
  object-fit: contain;
  padding: 3%;
}
.story-console .br-copy {
  min-height: 0;
  max-height: 22vh;
  overflow-y: auto;
  padding: 10px;
}
.story-console .br-copy:focus-visible {
  outline: 2px solid #c8ff80;
}
.story-console .skip-link {
  padding: 6px 0;
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
  .story-console .br-controls,
  .story-console .br-scrub {
    margin-top: 6px;
  }
}
@media (max-height: 700px) {
  .story-console header > span {
    display: none;
  }
  .story-console .br-copy {
    max-height: 16vh;
  }
}
</style>
