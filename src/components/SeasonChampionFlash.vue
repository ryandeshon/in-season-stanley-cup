<template>
  <div
    ref="rootRef"
    class="flash-page"
    :class="{ 'is-reduced-motion': reducedMotion }"
    data-test="season-champion-flash"
  >
    <div ref="stageRef" class="flash-stage">
      <section class="flash-hero" data-test="season-champion-flash-hero">
        <div class="flash-rink-bg" :style="backgroundMotionStyle"></div>
        <div class="flash-rink-ice" :style="iceMotionStyle"></div>

        <div class="flash-content">
          <p class="flash-kicker">Season Champion</p>
          <h2 class="flash-name">
            <span
              v-for="(letter, index) in championNameLetters"
              :key="`${letter}-${index}`"
              class="flash-name-letter"
              :style="nameLetterStyle(index)"
            >
              {{ letter === ' ' ? '\u00A0' : letter }}
            </span>
          </h2>

          <div class="flash-image-wrap" :style="imageMotionStyle">
            <img
              v-if="championImageSrc"
              :src="championImageSrc"
              :alt="`${championName} raising the cup`"
              class="flash-image"
              data-test="season-champion-flash-image"
              @error="emit('image-error')"
            />
          </div>
        </div>
      </section>
    </div>

    <section
      ref="revealRef"
      class="flash-reveal"
      :class="{ 'is-visible': revealVisible || reducedMotion }"
      data-test="season-champion-flash-reveal"
    >
      <p
        class="flash-quote"
        :class="{ 'is-live': quoteLive }"
        data-test="season-champion-flash-quote"
      >
        <span
          v-for="(char, index) in quoteCharacters"
          :key="`quote-${index}`"
          class="flash-quote-letter"
          :style="quoteLetterStyle(index)"
        >
          {{ char === ' ' ? '\u00A0' : char }}
        </span>
      </p>

      <div class="flash-team-grid">
        <div v-for="team in championTeams" :key="team" class="flash-team-item">
          <TeamLogo :team="team" width="58" height="58" />
        </div>
      </div>
    </section>
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

const rootRef = ref(null);
const stageRef = ref(null);
const revealRef = ref(null);
const reducedMotion = ref(false);
const revealVisible = ref(false);
const scrollProgress = ref(0);

let mediaQueryList = null;
let motionChangeHandler = null;
let intersectionObserver = null;
let scrollTicking = false;

const championName = computed(() => props.player?.name || 'Champion');
const championNameLetters = computed(() => Array.from(championName.value));
const championTeams = computed(() =>
  Array.isArray(props.player?.teams) ? props.player.teams : []
);
const quoteCharacters = computed(() => Array.from(props.quote || ''));
const canAnimate = computed(() => !reducedMotion.value);
const normalizedProgress = computed(() =>
  Math.max(0, Math.min(scrollProgress.value, 1))
);
const quoteLive = computed(
  () =>
    revealVisible.value ||
    reducedMotion.value ||
    normalizedProgress.value > 0.38
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

const backgroundMotionStyle = computed(() => {
  const baseStyle = {
    backgroundImage: `url(${seasonChampionRinkBackground})`,
  };
  if (!canAnimate.value) return baseStyle;
  return {
    ...baseStyle,
    transform: `translate3d(0, ${normalizedProgress.value * -38}px, 0)`,
  };
});

const iceMotionStyle = computed(() => {
  if (!canAnimate.value) return {};
  return {
    transform: `translate3d(0, ${normalizedProgress.value * -14}px, 0)`,
  };
});

function nameLetterStyle(index) {
  if (!canAnimate.value) {
    return {};
  }
  return {
    animationDelay: `${index * 50}ms`,
  };
}

function quoteLetterStyle(index) {
  if (!canAnimate.value) {
    return {};
  }
  return {
    animationDelay: `${200 + index * 30}ms`,
  };
}

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

function setupRevealObserver() {
  if (
    typeof window === 'undefined' ||
    !window.IntersectionObserver ||
    !revealRef.value
  ) {
    revealVisible.value = true;
    return;
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealVisible.value = true;
        }
      });
    },
    { threshold: 0.3 }
  );

  intersectionObserver.observe(revealRef.value);
}

onMounted(() => {
  setupReducedMotion();
  setupRevealObserver();
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

  if (intersectionObserver) {
    intersectionObserver.disconnect();
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
  inset: -10% 0 0;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  transition: transform 120ms linear;
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
  transition: transform 120ms linear;
}

.flash-content {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  gap: 0.65rem;
  width: min(94vw, 980px);
  padding: 1.2rem 1rem;
}

.flash-kicker {
  margin: 0;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  color: #0b4f79;
}

.flash-name {
  margin: 0;
  text-transform: uppercase;
  font-size: clamp(2.2rem, 10vw, 5.6rem);
  line-height: 0.95;
  color: #12344d;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.7);
}

.flash-name-letter {
  display: inline-block;
  opacity: 0;
  transform: translate3d(0, 18px, 0);
  animation: name-pop 450ms ease-out forwards;
}

.flash-image-wrap {
  width: min(80vw, 750px);
  transition: transform 120ms linear;
}

.flash-image {
  width: 100%;
  max-height: 74vh;
  object-fit: contain;
  filter: drop-shadow(0 12px 20px rgba(36, 80, 117, 0.24));
}

.flash-reveal {
  position: relative;
  z-index: 2;
  width: min(92vw, 900px);
  margin: -9vh auto 0;
  padding: 0 0 2rem;
  text-align: center;
  opacity: 0;
  transform: translate3d(0, 40px, 0);
  transition:
    opacity 380ms ease,
    transform 380ms ease;
}

.flash-reveal.is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.flash-quote {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 8vw, 5rem);
  line-height: 0.95;
  font-weight: 700;
  text-transform: uppercase;
  color: #ffeb6b;
  text-shadow:
    2px 2px 0 #000,
    0 0 10px rgba(255, 235, 107, 0.24);
}

.flash-quote-letter {
  display: inline-block;
  opacity: 0;
  transform: translate3d(0, 10px, 0);
}

.flash-quote.is-live .flash-quote-letter {
  animation: quote-rise 280ms ease-out forwards;
}

.flash-quote.is-live {
  animation: quote-float 3.2s ease-in-out infinite;
}

.flash-team-grid {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.flash-team-item {
  display: grid;
  place-items: center;
}

.is-reduced-motion .flash-stage {
  height: auto;
}

.is-reduced-motion .flash-hero {
  position: relative;
  min-height: auto;
  padding-top: 1rem;
}

.is-reduced-motion .flash-name-letter,
.is-reduced-motion .flash-quote.is-live,
.is-reduced-motion .flash-quote.is-live .flash-quote-letter {
  animation: none !important;
}

.is-reduced-motion .flash-reveal {
  opacity: 1;
  transform: none;
  margin-top: 0.8rem;
}

@media (max-width: 700px) {
  .flash-stage {
    height: 165vh;
  }

  .flash-reveal {
    margin-top: -7vh;
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

@keyframes name-pop {
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes quote-rise {
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes quote-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  25% {
    transform: translate3d(0, -3px, 0) rotate(0.3deg);
  }
  75% {
    transform: translate3d(0, 3px, 0) rotate(-0.3deg);
  }
}
</style>
