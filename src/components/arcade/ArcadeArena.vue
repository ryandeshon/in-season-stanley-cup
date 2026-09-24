<template>
  <section
    class="arcade-arena stone-frame"
    data-test="arcade-arena"
    :style="{ '--arena-background': `url(${arena.background})` }"
    :class="[
      {
        'reduced-motion': reducedMotion,
        'arena-paused': hidden || suspended,
        'pixi-ready': pixiReady,
      },
      `phase-${phase}`,
      `attack-${attack}`,
      `from-${attackingSide}`,
    ]"
  >
    <header class="arena-topline">
      <span class="eyebrow">{{ arena.name }}</span
      ><span class="arena-status"
        ><i :class="{ live: live }"></i
        >{{
          final
            ? 'FINAL'
            : live
              ? game.clock?.inIntermission
                ? 'INTERMISSION'
                : 'LIVE'
              : 'UP NEXT'
        }}</span
      >
    </header>
    <div class="arena-hud" aria-live="polite" aria-atomic="true">
      <div class="hud-team">
        <TeamLogo
          logo-mode="dark"
          :team="leftTeam?.abbrev"
          width="42"
          height="42"
        /><span>{{ leftTeam?.abbrev || 'TBD' }}</span>
      </div>
      <div class="hud-score">
        <strong
          >{{ displayScore(leftTeam) }}<span>:</span
          >{{ displayScore(rightTeam) }}</strong
        ><small>{{
          result
            ? 'FINAL SCORE'
            : final
              ? 'AWAITING CONFIRMATION'
              : live
                ? `PERIOD ${period || '—'} · ${clock}`
                : 'FACEOFF'
        }}</small>
      </div>
      <div class="hud-team right">
        <span>{{ rightTeam?.abbrev || 'TBD' }}</span
        ><TeamLogo
          logo-mode="dark"
          :team="rightTeam?.abbrev"
          width="42"
          height="42"
        />
      </div>
    </div>
    <div v-if="!live && !final" class="arena-start">{{ startTime }}</div>
    <div v-if="final && !result" class="arena-notice" role="status">
      Final result awaiting confirmed scores.
    </div>
    <div v-if="result" class="victory-heading">
      <span v-if="result.flawless" class="flawless" data-test="flawless-victory"
        >FLAWLESS VICTORY</span
      ><span v-else>VICTORY</span>
      <h2>
        {{ winnerName }}
      </h2>
      <p v-if="mirror">MIRROR MATCH RESOLVED</p>
    </div>
    <div class="fighters" :class="{ 'has-result': result }">
      <div
        v-for="side in sides"
        :key="side.key"
        class="fighter"
        :class="[
          side.key,
          stance(side),
          {
            selected: selected === side.key,
            'is-attacker': attackingSide === side.key,
            'is-receiver': attackingSide && attackingSide !== side.key,
          },
        ]"
        :data-test="
          side.key === 'left'
            ? 'champion-select-card'
            : 'challenger-select-card'
        "
      >
        <div class="fighter-label">
          <span>{{
            result
              ? side.team?.abbrev === result.winner.abbrev
                ? 'WINNER'
                : 'DEFEATED'
              : side.key === 'left'
                ? 'CUP HOLDER'
                : 'CHALLENGER'
          }}</span
          ><router-link
            v-if="side.player?.name"
            :to="`/player/${side.player.name}`"
            >{{ side.player.name }}</router-link
          ><strong v-else>Unknown owner</strong>
        </div>
        <button
          class="portrait-button v-card"
          :disabled="final"
          :aria-label="`Preview matchups if ${side.team?.abbrev || 'this team'} wins`"
          :aria-pressed="selected === side.key"
          @click="
            emit('select', side.key === 'left' ? 'champion' : 'challenger')
          "
        >
          <ExpressivePortrait
            v-if="!broken[side.player?.name] && art(side.player)"
            :name="side.player?.name"
            :emotion="portraitEmotion(side)"
            :flipped="shouldFlip(side)"
            @unavailable="broken[side.player?.name] = true"
          />
          <div v-else class="portrait-fallback">
            {{ side.player?.name || 'UNKNOWN'
            }}<span>Fighter portrait unavailable</span>
          </div>
          <span class="body-impact" aria-hidden="true"
            ><i></i><i></i><i></i
          ></span>
          <span
            v-if="
              phase === 'finish' && side.team?.abbrev === result?.loser.abbrev
            "
            class="finished-plaque"
            >FINISHED</span
          >
        </button>
        <div class="fighter-foot">
          <TeamLogo
            logo-mode="dark"
            :team="side.team?.abbrev"
            width="60"
            height="60"
          />
          <small v-if="live">{{ side.team?.sog ?? '—' }} SHOTS</small>
        </div>
      </div>
      <span class="arena-vs" aria-hidden="true">VS</span>
      <AttackCanvas
        :enabled="effects && !reducedMotion && !hidden && !suspended"
        :phase="phase"
        :attack="attack"
        :side="attackingSide"
        @ready="pixiReady = $event"
      />
      <div class="projectile" aria-hidden="true">
        <svg v-if="attack === 'lightning'" viewBox="0 0 120 60">
          <path d="M0 30 30 12 25 32 65 8 55 30 110 20 88 42 115 40" /></svg
        ><span v-else></span>
      </div>
    </div>
    <p class="arena-event sr-only" role="status">{{ announcement }}</p>
    <div class="arena-controls">
      <router-link
        :to="`/game/${game.id}`"
        class="arcade-button"
        data-test="view-game-details-link"
        >Game details <span aria-hidden="true">↗</span></router-link
      >
      <button
        v-if="result && !mirror"
        class="arcade-button secondary"
        :disabled="!effects"
        @click="playFinish"
      >
        Replay fatality
      </button>
      <button
        class="quiet-control"
        :aria-pressed="effects"
        @click="
          effects = !effects;
          clearAction();
        "
      >
        Effects {{ effects ? 'on' : 'off' }}
      </button>
      <button
        class="quiet-control"
        :aria-pressed="sound"
        @click="sound = !sound"
      >
        Sound {{ sound ? 'on' : 'off' }}
      </button>
    </div>
    <p class="arena-caption">
      {{
        result
          ? mirror
            ? 'One owner. Two teams. The cup stays in the same hands.'
            : `${characters[winnerName]?.finisher || 'Victory'} · ${result.winner.abbrev} wins ${result.winner.score}–${result.loser.score}`
          : live
            ? 'The cup is on the line.'
            : 'Select a fighter to preview the next defense.'
      }}
    </p>
    <p v-if="suspended" class="feed-status">
      Feed interrupted · showing the last known score
    </p>
  </section>
</template>
<script setup>
import { arenaForOwner } from '@/utilities/arcadeArenas';
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import TeamLogo from '@/components/TeamLogo.vue';
import AttackCanvas from './AttackCanvas.vue';
import ExpressivePortrait from './ExpressivePortrait.vue';
import { characters, livePoseManifest } from '@/utilities/arcadeAssets';
import {
  createArenaTracker,
  getPresentationResult,
} from '@/utilities/arcadePresentation';
const props = defineProps({
  game: { type: Object, required: true },
  leftPlayer: Object,
  rightPlayer: Object,
  leftTeam: Object,
  rightTeam: Object,
  season: String,
  clock: String,
  period: [String, Number],
  startTime: String,
  selectedRole: String,
  suspended: Boolean,
  leftEmotion: String,
  rightEmotion: String,
});
const emit = defineEmits(['select']);
const live = computed(() => ['LIVE', 'CRIT'].includes(props.game.gameState));
const final = computed(() => ['FINAL', 'OFF'].includes(props.game.gameState));
const result = computed(() => getPresentationResult(props.game));
const mirror = computed(
  () =>
    Boolean(props.leftPlayer?.name) &&
    props.leftPlayer?.name === props.rightPlayer?.name
);
const sides = computed(() => [
  { key: 'left', player: props.leftPlayer, team: props.leftTeam },
  { key: 'right', player: props.rightPlayer, team: props.rightTeam },
]);
const winnerName = computed(
  () =>
    sides.value.find((s) => s.team?.abbrev === result.value?.winner.abbrev)
      ?.player?.name || 'Unknown owner'
);
// The defender hosts the live game; a confirmed final transfers the realm.
const arena = computed(() =>
  arenaForOwner(result.value ? winnerName.value : props.leftPlayer?.name)
);
const selected = computed(() =>
  props.selectedRole === 'champion'
    ? 'left'
    : props.selectedRole === 'challenger'
      ? 'right'
      : ''
);
const displayScore = (team) =>
  Number.isInteger(team?.score) && team.score >= 0 ? team.score : '—';
const art = (player) => livePoseManifest[player?.name]?.ready;
const shouldFlip = (side) =>
  (livePoseManifest[side.player?.name]?.facing || 'right') !==
  (side.key === 'left' ? 'right' : 'left');
const broken = ref({});
const effects = ref(true);
const pixiReady = ref(false);
const sound = ref(false);
const reducedMotion = ref(false);
const hidden = ref(false);
const phase = ref('idle');
const attack = ref('fire');
const attackingSide = ref('');
const beforeHit = ref('Happy');
const announcement = ref('');
let timers = [];
let audio;
let media;
let played = new Set();
try {
  played = new Set(
    JSON.parse(sessionStorage.getItem('arcade-finished-games') || '[]')
  );
} catch {
  /* restricted storage uses the in-memory latch */
}
const track = createArenaTracker(played);
const clearAction = () => {
  timers.forEach(clearTimeout);
  timers = [];
  phase.value = 'idle';
  attackingSide.value = '';
};
function later(fn, delay) {
  timers.push(setTimeout(fn, delay));
}
function cue() {
  if (!sound.value || hidden.value) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio ||= new AudioContext();
  audio.resume().catch(() => {});
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(180, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    60,
    audio.currentTime + 0.18
  );
  gain.gain.setValueAtTime(0.05, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.22);
}
function playFinish() {
  clearAction();
  if (
    !result.value ||
    mirror.value ||
    !effects.value ||
    hidden.value ||
    reducedMotion.value
  )
    return;
  attackingSide.value = sides.value.find(
    (s) => s.team?.abbrev === result.value.winner.abbrev
  )?.key;
  attack.value = characters[winnerName.value]?.attack || 'fire';
  phase.value = 'finish';
  cue();
  later(clearAction, 2500);
}
function portraitEmotion(side) {
  if (result.value)
    return side.team?.abbrev === result.value.winner.abbrev ? 'Happy' : 'Sad';
  if (!live.value || props.game.clock?.inIntermission) return 'Happy';
  if (attackingSide.value && attackingSide.value !== side.key) {
    if (['impact', 'recover'].includes(phase.value)) return 'Anguish';
    if (['windup', 'travel'].includes(phase.value)) return beforeHit.value;
  }
  const opponent = sides.value.find((s) => s.key !== side.key)?.team;
  if (
    !Number.isInteger(side.team?.score) ||
    !Number.isInteger(opponent?.score) ||
    side.team.score >= opponent.score
  )
    return 'Happy';
  return (side.key === 'left' ? props.leftEmotion : props.rightEmotion) ===
    'Anguish'
    ? 'Anguish'
    : 'Angry';
}
function stance(side) {
  if (result.value)
    return side.team?.abbrev === result.value.winner.abbrev
      ? 'victory'
      : 'defeated';
  if (!live.value || props.game.clock?.inIntermission) return 'ready';
  if (
    (side.key === 'left' ? props.leftEmotion : props.rightEmotion) === 'Anguish'
  )
    return 'guarded';
  const opponent = sides.value.find((s) => s.key !== side.key)?.team;
  return side.team?.score > opponent?.score
    ? 'confident'
    : side.team?.score < opponent?.score
      ? 'guarded'
      : 'ready';
}
watch(
  () => [props.game, props.season, props.suspended, hidden.value],
  (_, previous) => {
    const event = track(props.game, {
      season: props.season,
      suspended: props.suspended || hidden.value,
    });
    if (event.type === 'settle') {
      if (event.cancel || props.suspended || hidden.value) clearAction();
      return;
    }
    clearAction();
    if (event.type === 'finish') {
      try {
        sessionStorage.setItem(
          'arcade-finished-games',
          JSON.stringify([...played])
        );
      } catch {
        /* storage is optional */
      }
      playFinish();
      return;
    }
    const side = sides.value.find((s) => s.team?.abbrev === event.team);
    if (!side || !effects.value) return;
    const prior = previous?.[0];
    const priorTeams = [prior?.homeTeam, prior?.awayTeam];
    const priorScorer = priorTeams.find((t) => t?.abbrev === event.team);
    const priorReceiver = priorTeams.find((t) => t && t.abbrev !== event.team);
    beforeHit.value =
      priorReceiver?.score < priorScorer?.score ? 'Angry' : 'Happy';
    attackingSide.value = side.key;
    attack.value = characters[side.player?.name]?.attack || 'fire';
    announcement.value = `Goal for ${event.team}. ${side.player?.name || 'The scoring owner'} attacks.`;
    if (reducedMotion.value) {
      phase.value = 'impact';
      later(clearAction, 700);
      return;
    }
    phase.value = 'windup';
    later(() => {
      phase.value = 'travel';
      cue();
    }, 150);
    later(() => (phase.value = 'impact'), 400);
    later(() => (phase.value = 'recover'), 800);
    later(clearAction, 1400);
  },
  { immediate: true }
);
watch(
  [
    () => props.leftTeam?.abbrev,
    () => props.rightTeam?.abbrev,
    () => props.leftPlayer?.name,
    () => props.rightPlayer?.name,
  ],
  clearAction
);
function visibility() {
  hidden.value = document.hidden;
  if (hidden.value) clearAction();
}
function motion() {
  reducedMotion.value = media.matches;
  clearAction();
}
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion();
  media.addEventListener('change', motion);
  visibility();
  document.addEventListener('visibilitychange', visibility);
});
onBeforeUnmount(() => {
  clearAction();
  media?.removeEventListener('change', motion);
  document.removeEventListener('visibilitychange', visibility);
  audio?.close();
});
</script>
