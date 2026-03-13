import { computed, ref } from 'vue';
import { DateTime } from 'luxon';
import nhlApi from '@/services/nhlApi';

/**
 * useUpcomingMatchups
 * Responsibility: manage off-day and winner-conditional upcoming matchup data.
 *
 * Inputs:
 * - `todaysGame` (Ref<object>): active game payload used for date context.
 * - `todaysWinner` (Ref<object>): winner payload used for next-game card mapping.
 * - `playerChampion` (Ref<object>): champion player/team context.
 * - `playerChallenger` (Ref<object>): challenger player/team context.
 * - `findPlayerByTeam` (Function): team->player resolver for owner mapping.
 * - `scheduleClient` (Object, optional): schedule API client with `getSchedule`.
 *
 * Outputs:
 * - State refs for possible/conditional matchup lists and loading flags.
 * - `firstGameNonChampionTeam` and `conditionalMatchupsHeading` computed values.
 * - Actions: `resetConditionalMatchups`, `handleWinnerSelection`, `getPossibleMatchUps`.
 */
export function useUpcomingMatchups({
  todaysGame,
  todaysWinner,
  playerChampion,
  playerChallenger,
  findPlayerByTeam,
  scheduleClient = nhlApi,
}) {
  const potentialLoading = ref(true);
  const possibleMatchUps = ref([]);
  const selectedWinnerRole = ref('');
  const conditionalMatchups = ref([]);
  const conditionalMatchupsLoading = ref(false);
  let conditionalMatchupsRequestId = 0;

  const firstGameNonChampionTeam = computed(() => {
    if (possibleMatchUps.value.length === 0) {
      return null;
    }

    const firstGame = possibleMatchUps.value[0];
    const winnerAbbrev = todaysWinner.value?.abbrev;
    const nonChampionTeam =
      firstGame.homeTeam?.abbrev === winnerAbbrev
        ? firstGame.awayTeam
        : firstGame.homeTeam;

    if (!nonChampionTeam?.abbrev) {
      return null;
    }

    const player = findPlayerByTeam(nonChampionTeam.abbrev);
    return {
      date: firstGame.dateTime,
      team: nonChampionTeam,
      player,
    };
  });

  const conditionalMatchupsHeading = computed(() => {
    if (selectedWinnerRole.value === 'champion') {
      return `Possible Upcoming Match-ups If ${playerChampion.value?.name || 'Champion'} Wins Tonight`;
    }
    if (selectedWinnerRole.value === 'challenger') {
      return `Possible Upcoming Match-ups If ${playerChallenger.value?.name || 'Challenger'} Wins Tonight`;
    }
    return 'Possible Upcoming Match-ups';
  });

  function resetConditionalMatchups() {
    conditionalMatchupsRequestId += 1;
    selectedWinnerRole.value = '';
    conditionalMatchups.value = [];
    conditionalMatchupsLoading.value = false;
  }

  async function handleWinnerSelection(role) {
    selectedWinnerRole.value = role;
    const winnerTeamAbbrev =
      role === 'champion'
        ? playerChampion.value?.championTeam?.abbrev
        : playerChallenger.value?.challengerTeam?.abbrev;

    if (!winnerTeamAbbrev) {
      conditionalMatchups.value = [];
      return;
    }

    await getConditionalMatchUps(winnerTeamAbbrev);
  }

  async function getConditionalMatchUps(winnerTeamAbbrev) {
    const requestId = ++conditionalMatchupsRequestId;
    conditionalMatchupsLoading.value = true;
    const gameDate = todaysGame.value?.startTimeUTC
      ? DateTime.fromISO(todaysGame.value.startTimeUTC)
      : DateTime.now();
    const targetDate = gameDate.plus({ days: 1 }).toFormat('yyyy-MM-dd');

    try {
      const scheduleData = await scheduleClient.getSchedule(targetDate);
      const gameWeek = Array.isArray(scheduleData?.data?.gameWeek)
        ? scheduleData.data.gameWeek
        : [];
      const remainingWeekGames = gameWeek
        .filter((entry) => entry?.date && entry.date >= targetDate)
        .flatMap((entry) => entry?.games || []);

      const resolvedMatchups = remainingWeekGames
        .filter(
          (game) =>
            game?.homeTeam?.abbrev === winnerTeamAbbrev ||
            game?.awayTeam?.abbrev === winnerTeamAbbrev
        )
        .map((game) => {
          const opponentTeam =
            game.homeTeam.abbrev === winnerTeamAbbrev
              ? game.awayTeam
              : game.homeTeam;

          return {
            ...game,
            dateTime: DateTime.fromISO(game.startTimeUTC).toFormat(
              'MM/dd h:mm a ZZZZ'
            ),
            opponentTeam,
          };
        })
        .sort(
          (a, b) =>
            DateTime.fromISO(a.startTimeUTC).toMillis() -
            DateTime.fromISO(b.startTimeUTC).toMillis()
        );

      if (requestId === conditionalMatchupsRequestId) {
        conditionalMatchups.value = resolvedMatchups;
      }
    } catch (err) {
      console.error('Failed to load conditional matchups', err);
      if (requestId === conditionalMatchupsRequestId) {
        conditionalMatchups.value = [];
      }
    } finally {
      if (requestId === conditionalMatchupsRequestId) {
        conditionalMatchupsLoading.value = false;
      }
    }
  }

  async function getPossibleMatchUps(championTeam) {
    potentialLoading.value = true;
    const upcomingGames = [];
    const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');

    if (!championTeam) {
      possibleMatchUps.value = [];
      potentialLoading.value = false;
      return;
    }

    try {
      const scheduleData = await scheduleClient.getSchedule(tomorrow);
      const gameWeek = scheduleData?.data?.gameWeek;
      if (!Array.isArray(gameWeek)) {
        possibleMatchUps.value = [];
        return;
      }

      gameWeek.forEach((dateEntry) => {
        (dateEntry?.games || []).forEach((game) => {
          const { id, homeTeam, awayTeam, startTimeUTC } = game;
          if (
            homeTeam?.abbrev === championTeam ||
            awayTeam?.abbrev === championTeam
          ) {
            upcomingGames.push({
              id,
              homeTeam,
              awayTeam,
              dateTime:
                DateTime.fromISO(startTimeUTC).toFormat('MM/dd h:mm a ZZZZ'),
            });
          }
        });
      });
      possibleMatchUps.value = upcomingGames;
    } catch (err) {
      console.error('Failed to load possible matchups', err);
      possibleMatchUps.value = [];
    } finally {
      potentialLoading.value = false;
    }
  }

  return {
    potentialLoading,
    possibleMatchUps,
    selectedWinnerRole,
    conditionalMatchups,
    conditionalMatchupsLoading,
    firstGameNonChampionTeam,
    conditionalMatchupsHeading,
    resetConditionalMatchups,
    handleWinnerSelection,
    getPossibleMatchUps,
  };
}
