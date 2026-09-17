<template>
  <div class="story-page">
    <div class="story-wrap">
      <div class="story-heading">
        <p class="eyebrow">IN SEASON CUP · A SEASON THREE PROLOGUE</p>
        <h1>The Black Rink</h1>
        <p>A champion takes the throne. Three challengers enter his realm.</p>
      </div>
      <div class="story-controls">
        <button class="arcade-button" @click="start">
          {{ finished ? 'Replay · 60 seconds' : 'Play · 60 seconds' }}</button
        ><button
          v-if="timed"
          class="arcade-button secondary"
          @click="playing = !playing"
        >
          {{ playing ? 'Pause' : 'Resume' }}</button
        ><button
          class="quiet-control"
          @click="
            timed = false;
            playing = false;
          "
        >
          Scroll mode</button
        ><router-link class="quiet-control" to="/"
          >Skip to the arena ↗</router-link
        >
      </div>
      <div
        v-if="timed"
        class="story-progress"
        role="progressbar"
        aria-label="Story progress"
        :aria-valuenow="Math.floor(elapsed)"
        aria-valuemin="0"
        aria-valuemax="60"
      >
        <span :style="{ width: `${(elapsed / 60) * 100}%` }"></span>
      </div>
      <article
        v-for="scene in visibleScenes"
        :key="scene.title"
        class="story-scene stone-frame"
      >
        <img :src="scene.art" :alt="scene.alt" />
        <div class="story-copy">
          <span class="eyebrow">0{{ scene.index + 1 }} / 03</span>
          <h2>{{ scene.title }}</h2>
          <p>{{ scene.copy }}</p>
        </div>
      </article>
      <nav class="story-chapters" aria-label="Story chapters">
        <button
          v-for="(scene, index) in scenes"
          :key="scene.title"
          :aria-pressed="timed && active === index"
          @click="select(index)"
        >
          0{{ index + 1 }} · {{ scene.title }}
        </button>
      </nav>
      <p class="story-note">
        The story sets the stage. Scores, ownership and standings always follow
        the real game.
      </p>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
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
const timed = ref(false),
  playing = ref(false),
  elapsed = ref(0);
const active = computed(() => Math.min(2, Math.floor(elapsed.value / 20)));
const indexedScenes = scenes.map((scene, index) => ({ ...scene, index }));
const visibleScenes = computed(() =>
  timed.value ? [indexedScenes[active.value]] : indexedScenes
);
const finished = computed(() => elapsed.value >= 60);
function start() {
  timed.value = true;
  elapsed.value = 0;
  playing.value = true;
}
function select(index) {
  timed.value = true;
  playing.value = false;
  elapsed.value = index * 20;
}
let timer, last;
function pauseHidden() {
  if (document.hidden) playing.value = false;
}
onMounted(() => {
  last = performance.now();
  timer = setInterval(() => {
    const now = performance.now();
    if (playing.value && !document.hidden) {
      elapsed.value = Math.min(60, elapsed.value + (now - last) / 1000);
      if (finished.value) playing.value = false;
    }
    last = now;
  }, 100);
  document.addEventListener('visibilitychange', pauseHidden);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener('visibilitychange', pauseHidden);
});
</script>
<style scoped>
.story-page {
  min-height: 100vh;
  background: #101410;
  color: #f0efe5;
  padding: 44px 24px 70px;
  font:
    15px/1.8 Arial,
    sans-serif;
}
.story-wrap {
  max-width: 1000px;
  margin: auto;
}
.story-page h1,
.story-page h2 {
  font-family: 'Press Start 2P', monospace;
  border: 0;
  color: #f0efe5;
}
.story-page h1 {
  font-size: 28px;
  line-height: 1.7;
}
.story-heading > p {
  color: #b7c1ad;
}
.story-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin: 24px 0;
}
.story-scene {
  margin: 28px 0;
  background: #222820;
}
.story-scene img {
  width: 100%;
  max-height: 530px;
  object-fit: cover;
  display: block;
}
.story-copy {
  padding: 24px 30px;
  background: #191f17;
}
.story-copy h2 {
  font-size: 18px;
  margin: 18px 0;
}
.story-copy p {
  max-width: 760px;
  margin: 0;
  font-size: 16px;
  line-height: 1.85;
  color: #d3d9ca;
}
.story-progress {
  height: 4px;
  background: #384130;
}
.story-progress span {
  display: block;
  height: 100%;
  background: #e4bd58;
}
.story-chapters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.story-chapters button {
  min-height: 44px;
  padding: 8px;
  border-bottom: 1px solid #657558;
}
.story-chapters button[aria-pressed='true'] {
  color: #e4bd58;
  border-color: #e4bd58;
}
.story-note {
  margin: 28px 0;
  font-size: 12px;
  color: #aebaa1;
}
@media (max-width: 600px) {
  .story-page {
    padding: 28px 14px 64px;
  }
  .story-page h1 {
    font-size: 20px;
  }
  .story-copy {
    padding: 20px 16px;
  }
  .story-copy p {
    font-size: 14px;
  }
  .story-controls {
    gap: 8px;
  }
}
</style>
