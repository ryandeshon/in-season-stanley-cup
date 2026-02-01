<template>
  <div class="mb-4">
    <div class="flex items-center justify-between mb-1">
      <span class="text-sm font-semibold uppercase tracking-wide"
        >Today's Matchup</span
      >
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
        size="18"
        width="2"
      />
    </div>
    <v-select
      v-model="internalValue"
      :items="formattedMatchups"
      item-title="title"
      item-value="value"
      variant="outlined"
      density="comfortable"
      hide-details
      :loading="loading"
      :disabled="disabled || loading || !formattedMatchups.length"
      placeholder="Select matchup"
    >
      <template #selection="{ item }">
        <div class="flex items-center gap-2">
          <span>{{ item?.title }}</span>
          <v-chip
            v-if="item?.raw?.isCupGame"
            size="x-small"
            color="primary"
            variant="flat"
            class="uppercase tracking-wide font-bold"
          >
            Cup Game
          </v-chip>
        </div>
      </template>
      <template #item="{ props, item }">
        <v-list-item v-bind="props">
          <v-list-item-title class="flex items-center gap-2">
            <span>{{ item?.raw?.title }}</span>
            <v-chip
              v-if="item?.raw?.isCupGame"
              size="x-small"
              color="primary"
              variant="flat"
              class="uppercase tracking-wide font-bold"
            >
              Cup Game
            </v-chip>
          </v-list-item-title>
          <v-list-item-subtitle v-if="item?.raw?.subtitle">
            {{ item.raw.subtitle }}
          </v-list-item-subtitle>
        </v-list-item>
      </template>
    </v-select>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { DateTime } from 'luxon';

const props = defineProps({
  matchups: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: [String, Number, null],
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const internalValue = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit('update:modelValue', value);
  },
});

const formattedMatchups = computed(() =>
  props.matchups.map((game) => ({
    title: formatMatchupTitle(game),
    value: game.id,
    subtitle: formatSubtitle(game.startTimeUTC),
    isCupGame: game.isCupGame,
  }))
);

function formatMatchupTitle(game) {
  const away = game.awayTeam?.abbrev || 'TBD';
  const home = game.homeTeam?.abbrev || 'TBD';
  const cupSuffix = game.isCupGame ? ' (Cup Game)' : '';
  return `${away} vs ${home}${cupSuffix}`;
}

function formatSubtitle(startTime) {
  if (!startTime) return '';
  try {
    return DateTime.fromISO(startTime).toFormat('h:mm a ZZZZ');
  } catch (err) {
    return '';
  }
}
</script>
