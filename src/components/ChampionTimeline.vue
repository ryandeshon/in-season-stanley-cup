<template>
  <section class="mt-8" :data-test="rootDataTest">
    <h2 class="text-2xl font-bold mb-2">{{ title }}</h2>
    <p
      v-if="streakText"
      class="text-sm mb-2"
      :data-test="`${testPrefix}-streak`"
    >
      {{ streakText }}
    </p>
    <template v-if="loading">
      <div class="flex justify-center items-center h-20">
        <v-progress-circular
          indeterminate
          color="primary"
          :data-test="`${testPrefix}-loading`"
        />
      </div>
    </template>
    <p v-else-if="error" :data-test="`${testPrefix}-error`">{{ error }}</p>
    <template v-else-if="entries.length">
      <ul class="list-none p-0 m-0" :data-test="`${testPrefix}-list`">
        <li
          v-for="(entry, index) in entries"
          :key="entry.gameId || entry.recordedAt || index"
          class="py-2 border-b border-black/10"
          :data-test="`${testPrefix}-item`"
        >
          {{ entry.summary }}
        </li>
      </ul>
      <div v-if="hasMore" class="mt-3">
        <v-btn
          size="small"
          variant="outlined"
          :data-test="`${testPrefix}-load-more`"
          @click="$emit('load-more')"
        >
          Load More
        </v-btn>
      </div>
    </template>
    <p v-else :data-test="`${testPrefix}-empty`">{{ emptyMessage }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: {
    type: String,
    default: 'Champion Timeline',
  },
  entries: {
    type: Array,
    default: () => [],
  },
  streak: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
  emptyMessage: {
    type: String,
    default: 'No champion transitions recorded yet.',
  },
  rootDataTest: {
    type: String,
    default: 'champion-timeline',
  },
  testPrefix: {
    type: String,
    default: 'champion-history',
  },
});

defineEmits(['load-more']);

const streakText = computed(() => {
  if (!props.streak || !Number.isFinite(Number(props.streak.count))) {
    return '';
  }

  const count = Number(props.streak.count);
  if (count <= 0) return '';

  const owner = props.streak.owner || 'Unknown';
  const team = props.streak.team || 'Unknown';
  const defenseLabel = count === 1 ? 'defense' : 'defenses';
  return `Current Streak: ${owner} (${team}) \u2022 ${count} ${defenseLabel}`;
});
</script>
