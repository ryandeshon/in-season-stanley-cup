<template>
  <div
    class="flash-page"
    :class="{ 'is-reduced-motion': reducedMotion }"
    data-test="season-champion-flash"
  >
    <div ref="stageRef" class="flash-stage">
      <section class="flash-hero" data-test="season-champion-flash-hero">
        <div class="flash-rink-bg" :style="backgroundStaticStyle"></div>
        <div class="flash-rink-ice"></div>

        <div class="flash-content">
          <div class="flash-image-wrap" :style="imageMotionStyle">
            <img
              v-if="championImageSrc"
              :src="championImageSrc"
              :alt="`${championName} raising the cup`"
              class="flash-image"
              data-test="season-champion-flash-image"
              @error="emit('image-error')"
            />

            <div
              class="flash-speech-bubble"
              :class="{ 'is-visible': bubbleVisible }"
              data-test="season-champion-flash-bubble"
            >
              <p class="flash-speech-bubble-text">{{ quote }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="flash-team-bar">
      <div
        v-for="team in championTeams"
        :key="team"
        class="flash-team-bar-item"
      >
        <TeamLogo :team="team" width="32" height="32" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import TeamLogo from '@/components/TeamLogo.vue';
import seasonChampionRinkBackground from '@/assets/backgrounds/season-champion-rink.png';

const props = defineProps({
  player: {
    type: Object,
    default: () => null,
  },
  championImageSrc: {
    type: String,
    default: '',
  },
  quote: {
    type: String,
    default: 'Suck It Nerds',
  },
});
const emit = defineEmits(['image-error']);

const stageRef = ref(null);
const reducedMotion = ref(false);
const scrollProgress = ref(0);

let mediaQueryList = null;
let motionChangeHandler = null;
let scrollTicking = false;

const championName = computed(() => props.player?.name || 'Champion');
const championTeams = computed(() =>
  Array.isArray(props.player?.teams) ? props.player.teams : []
);
const canAnimate = computed(() => !reducedMotion.value);
const normalizedProgress = computed(() =>
  Math.max(0, Math.min(scrollProgress.value, 1))
);
const bubbleVisible = computed(
  () => reducedMotion.value || normalizedProgress.value >= 0.92
);

const imageMotionStyle = computed(() => {
  if (!canAnimate.value) {
    return { transform: 'none' };
  }

  const translateY = 24 - normalizedProgress.value * 116;
  const rotate = -2 + normalizedProgress.value * 3.5;
  const scale = 1 + normalizedProgress.value * 0.05;

  return {
    transform: `translate3d(0, ${translateY}px, 0) scale(${scale}) rotate(${rotate}deg)`,
  };
});

const backgroundStaticStyle = computed(() => ({
  backgroundImage: `url(${seasonChampionRinkBackground})`,
}));

function updateScrollProgress() {
  if (!stageRef.value || reducedMotion.value) {
    scrollProgress.value = 0;
    return;
  }

  const stageHeight = stageRef.value.offsetHeight;
  const maxScroll = Math.max(stageHeight - window.innerHeight, 1);
  const rect = stageRef.value.getBoundingClientRect();
  const consumed = Math.min(Math.max(-rect.top, 0), maxScroll);
  scrollProgress.value = consumed / maxScroll;
}

function onScrollOrResize() {
  if (scrollTicking) return;
  scrollTicking = true;
  window.requestAnimationFrame(() => {
    updateScrollProgress();
    scrollTicking = false;
  });
}

function setupReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return;

  mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.value = Boolean(mediaQueryList.matches);

  motionChangeHandler = (event) => {
    reducedMotion.value = Boolean(event.matches);
    if (reducedMotion.value) {
      scrollProgress.value = 0;
    } else {
      updateScrollProgress();
    }
  };

  mediaQueryList.addEventListener('change', motionChangeHandler);
}

onMounted(() => {
  setupReducedMotion();
  updateScrollProgress();
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollOrResize);
  window.removeEventListener('resize', onScrollOrResize);

  if (mediaQueryList && motionChangeHandler) {
    mediaQueryList.removeEventListener('change', motionChangeHandler);
  }
});
</script>

<style scoped>
.flash-page {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  overflow: hidden;
  color: #15202b;
}

.flash-stage {
  position: relative;
  height: 180vh;
}

.flash-hero {
  position: sticky;
  top: 0;
  min-height: 100vh;
  overflow: hidden;
  display: grid;
  place-items: center;
  text-align: center;
}

.flash-rink-bg {
  position: absolute;
  inset: 0;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
}

.flash-rink-ice {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(5, 20, 34, 0.38) 0%,
    rgba(8, 30, 52, 0.18) 32%,
    rgba(233, 248, 255, 0.06) 60%,
    rgba(245, 252, 255, 0.1) 100%
  );
  mix-blend-mode: multiply;
}

.flash-content {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 0;
}

.flash-image-wrap {
  position: relative;
  width: min(90vw, 850px);
  transition: transform 120ms linear;
}

.flash-image {
  width: 100%;
  max-height: 85vh;
  object-fit: contain;
  filter: drop-shadow(0 12px 20px rgba(36, 80, 117, 0.24));
}

.flash-speech-bubble {
  position: absolute;
  top: -0.5rem;
  right: -1rem;
  z-index: 2;
  background: #fff;
  color: #15202b;
  border-radius: 1.2rem;
  padding: 0.6rem 1.2rem;
  font-size: clamp(1rem, 3.5vw, 1.6rem);
  font-weight: 700;
  text-transform: uppercase;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  opacity: 0;
  transform: scale(0.7) translate3d(0, 10px, 0);
  transition:
    opacity 350ms ease,
    transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.flash-speech-bubble.is-visible {
  opacity: 1;
  transform: scale(1) translate3d(0, 0, 0);
  pointer-events: auto;
}

.flash-speech-bubble::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 24px;
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 12px solid #fff;
}

.flash-speech-bubble-text {
  margin: 0;
  white-space: nowrap;
}

.flash-team-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  background: linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.45) 0%,
    rgba(0, 0, 0, 0) 100%
  );
  pointer-events: none;
}

.flash-team-bar-item {
  display: grid;
  place-items: center;
  pointer-events: auto;
}

.is-reduced-motion .flash-stage {
  height: auto;
}

.is-reduced-motion .flash-hero {
  position: relative;
  min-height: auto;
  padding-top: 1rem;
}

.is-reduced-motion .flash-speech-bubble {
  opacity: 1;
  transform: none;
  transition: none;
}

@media (max-width: 700px) {
  .flash-stage {
    height: 165vh;
  }

  .flash-speech-bubble {
    right: 0;
    font-size: clamp(0.85rem, 3vw, 1.2rem);
    padding: 0.4rem 0.8rem;
  }

  .flash-team-bar {
    gap: 0.3rem;
    padding: 0.25rem 0.4rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flash-stage {
    height: auto;
  }

  .flash-hero {
    position: relative;
    min-height: auto;
  }
}
</style>
