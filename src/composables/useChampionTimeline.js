import { computed, ref, unref, watch } from 'vue';
import {
  areSeasonContractEndpointsEnabled,
  getChampionHistory,
  shouldUseContractFallback,
} from '@/services/championServices';
import {
  hasSessionWarning,
  setSessionWarning,
} from '@/utilities/sessionWarnings';

const DEFAULT_PAGE_SIZE = 6;
const DEFAULT_FETCH_LIMIT = 200;

function resolveValue(value) {
  if (typeof value === 'function') return value();
  return unref(value);
}

function resolveOwnerResolver(ownerResolver) {
  const resolved = unref(ownerResolver);
  return typeof resolved === 'function' ? resolved : null;
}

function toHistorySortKey(entry = {}) {
  const timestamp = Date.parse(entry?.recordedAt || '');
  if (Number.isFinite(timestamp)) return timestamp;
  const gameIdNumber = Number(entry?.gameId);
  if (Number.isFinite(gameIdNumber)) return gameIdNumber;
  return Number.NEGATIVE_INFINITY;
}

function resolveOwnerName(ownerResolver, teamAbbrev) {
  if (!teamAbbrev) return 'Unknown';
  if (typeof ownerResolver !== 'function') return 'Unknown';

  try {
    return ownerResolver(teamAbbrev) || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function formatRecordedDate(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return 'Unknown date';
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
  });
}

function mapHistoryEntry(entry, ownerResolver) {
  const winnerTeam = entry?.winnerTeam || 'Unknown';
  const loserTeam = entry?.loserTeam || 'Unknown';
  const winnerOwner = resolveOwnerName(ownerResolver, winnerTeam);
  const loserOwner = resolveOwnerName(ownerResolver, loserTeam);
  const winnerScore = Number(entry?.winnerScore);
  const loserScore = Number(entry?.loserScore);
  const hasScore = Number.isFinite(winnerScore) && Number.isFinite(loserScore);
  const scoreLabel = hasScore ? ` (${winnerScore}-${loserScore})` : '';
  const recordedDateLabel = formatRecordedDate(entry?.recordedAt);

  return {
    ...entry,
    winnerTeam,
    loserTeam,
    winnerOwner,
    loserOwner,
    recordedDateLabel,
    summary: `${winnerOwner} \u2022 ${winnerTeam} def. ${loserTeam}${scoreLabel} \u2022 ${recordedDateLabel}`,
  };
}

function resolveStreak(mappedEntries = []) {
  if (!Array.isArray(mappedEntries) || mappedEntries.length === 0) {
    return null;
  }

  const latestWinner = mappedEntries[0]?.winnerTeam;
  if (!latestWinner || latestWinner === 'Unknown') {
    return null;
  }

  let count = 0;
  for (const entry of mappedEntries) {
    if (entry?.winnerTeam !== latestWinner) {
      break;
    }
    count += 1;
  }

  if (!count) return null;

  return {
    team: latestWinner,
    owner: mappedEntries[0]?.winnerOwner || 'Unknown',
    count,
  };
}

export function useChampionTimeline({
  season,
  pageSize = DEFAULT_PAGE_SIZE,
  fetchLimit = DEFAULT_FETCH_LIMIT,
  ownerResolver,
  warningSessionKey = 'champion-timeline-contract-warning',
} = {}) {
  const rawEntries = ref([]);
  const visibleCount = ref(pageSize);
  const loading = ref(false);
  const error = ref('');
  const warning = ref('');

  const entries = computed(() => {
    const resolver = resolveOwnerResolver(ownerResolver);

    return [...rawEntries.value]
      .sort((a, b) => toHistorySortKey(b) - toHistorySortKey(a))
      .map((entry) => mapHistoryEntry(entry, resolver));
  });

  const visibleEntries = computed(() =>
    entries.value.slice(0, visibleCount.value)
  );

  const hasMore = computed(
    () => visibleEntries.value.length < entries.value.length
  );

  const streak = computed(() => resolveStreak(entries.value));

  function showWarningOnce(message) {
    if (!message) return;
    if (!warningSessionKey) {
      warning.value = message;
      return;
    }
    if (!hasSessionWarning(warningSessionKey)) {
      setSessionWarning(warningSessionKey);
      warning.value = message;
      return;
    }
    warning.value = '';
  }

  async function load() {
    loading.value = true;
    error.value = '';
    warning.value = '';
    visibleCount.value = pageSize;

    if (!areSeasonContractEndpointsEnabled()) {
      rawEntries.value = [];
      showWarningOnce(
        'Champion timeline checks are disabled by configuration (VUE_APP_ENABLE_SEASON_CONTRACTS=false).'
      );
      loading.value = false;
      return;
    }

    try {
      const response = await getChampionHistory({
        season: resolveValue(season),
        limit: fetchLimit,
      });
      rawEntries.value = Array.isArray(response?.history)
        ? response.history
        : [];
    } catch (requestError) {
      rawEntries.value = [];
      if (shouldUseContractFallback(requestError)) {
        showWarningOnce(
          'Backend timeline endpoints from this branch are not deployed in this environment yet. Showing timeline empty state.'
        );
      } else {
        error.value =
          'Champion timeline is unavailable right now. Please try again later.';
        console.error('Error loading champion history:', requestError);
      }
    } finally {
      loading.value = false;
    }
  }

  function loadMore() {
    visibleCount.value = Math.min(
      entries.value.length,
      visibleCount.value + pageSize
    );
  }

  watch(
    () => resolveValue(season),
    (nextSeason, previousSeason) => {
      if (!nextSeason || nextSeason === previousSeason) return;
      load();
    }
  );

  return {
    entries,
    visibleEntries,
    streak,
    loading,
    error,
    warning,
    hasMore,
    load,
    loadMore,
  };
}
