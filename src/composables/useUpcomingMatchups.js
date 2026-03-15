import { ref, computed } from 'vue';
import { DateTime } from 'luxon';
import nhlApi from '@/services/nhlApi';

/**
 * Home page schedule/matchup orchestration for:
 * - Cup-day matchup options
 * - Winner-conditional upcoming matchups
 * - Off-day possible champion defenses
 *
 * Inputs:
 * - Refs: `todaysGame`, `todaysWinner`, `cupGameId`, `selectedGameId`,
 *   `playerChampion`, `playerChallenger`
 * - `findPlayerByTeam(teamAbbrev): player | undefined`
 *
 * Outputs:
 * - Matchup refs/computed and loaders used by HomePage rendering.
 */
export function useUpcomingMatchups({
  todaysGame,
  todaysWinner,
  cupGameId,
  selectedGameId,
  playerChampion,
  playerChallenger,
  findPlayerByTeam,
} = {}) {
  const resolvePlayerByTeam = (teamAbbrev) =>
    typeof findPlayerByTeam === 'function'
      ? findPlayerByTeam(teamAbbrev)
      : undefined;

  const potentialLoading = ref(true);
  const possibleMatchUps = ref([]);
  const matchupOptions = ref([]);
  const matchupOptionsLoading = ref(false);
  const selectedWinnerRole = ref('');
  const conditionalMatchups = ref([]);
  const conditionalMatchupsLoading = ref(false);
  let conditionalMatchupsRequestId = 0;

  const firstGameNonChampionTeam = computed(() => {
    if (possibleMatchUps.value.length === 0) {
      return null;
    }
    const firstGame = possibleMatchUps.value[0];
    const nonChampionTeam =
      firstGame.homeTeam.abbrev === todaysWinner?.value?.abbrev
        ? firstGame.awayTeam
        : firstGame.homeTeam;
    const player = resolvePlayerByTeam(nonChampionTeam.abbrev);
    return {
      date: firstGame.dateTime,
      team: nonChampionTeam,
      player,
    };
  });

  const conditionalMatchupsHeading = computed(() => {
    if (selectedWinnerRole.value === 'champion') {
      return `Possible Upcoming Match-ups If ${playerChampion?.value?.name || 'Champion'} Wins Tonight`;
    }
    if (selectedWinnerRole.value === 'challenger') {
      return `Possible Upcoming Match-ups If ${playerChallenger?.value?.name || 'Challenger'} Wins Tonight`;
    }
    return 'Possible Upcoming Match-ups';
  });

  function buildMatchupLabel(game, defaultGameId) {
    const awayTeam = game?.awayTeam?.abbrev || 'AWAY';
    const homeTeam = game?.homeTeam?.abbrev || 'HOME';
    const isCupMatchup = String(game?.id) === String(defaultGameId);
    return `${awayTeam} @ ${homeTeam}${isCupMatchup ? ' (Cup Defense)' : ''}`;
  }

  async function loadMatchupOptions() {
    if (!cupGameId?.value) {
      matchupOptions.value = [];
      return;
    }

    matchupOptionsLoading.value = true;
    const scheduleDate = todaysGame?.value?.startTimeUTC
      ? DateTime.fromISO(todaysGame.value.startTimeUTC).toFormat('yyyy-MM-dd')
      : DateTime.now().toFormat('yyyy-MM-dd');

    try {
      const scheduleData = await nhlApi.getSchedule(scheduleDate);
      const gameWeek = scheduleData?.data?.gameWeek || [];
      const datedGames = gameWeek
        .filter((entry) => entry?.date === scheduleDate)
        .flatMap((entry) => entry?.games || []);
      const currentDayGames = datedGames.length
        ? datedGames
        : gameWeek.flatMap((entry) => entry?.games || []);
      const cupGame = currentDayGames.find(
        (game) => String(game.id) === String(cupGameId.value)
      );
      matchupOptions.value = cupGame
        ? [
            {
              id: String(cupGame.id),
              label: buildMatchupLabel(cupGame, cupGameId.value),
            },
          ]
        : [];

      if (!matchupOptions.value.length) {
        matchupOptions.value = [
          {
            id: String(cupGameId.value),
            label: `Cup Matchup (${cupGameId.value})`,
          },
        ];
      }
    } catch (err) {
      console.error('Failed to load game-day matchups', err);
      matchupOptions.value = [
        {
          id: String(cupGameId.value),
          label: `Cup Matchup (${cupGameId.value})`,
        },
      ];
    } finally {
      selectedGameId.value = String(
        selectedGameId.value ||
          matchupOptions.value.find(
            (option) => String(option.id) === String(cupGameId.value)
          )?.id ||
          matchupOptions.value[0]?.id ||
          cupGameId.value
      );
      matchupOptionsLoading.value = false;
    }
  }

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
        ? playerChampion?.value?.championTeam?.abbrev
        : playerChallenger?.value?.challengerTeam?.abbrev;

    if (!winnerTeamAbbrev) {
      conditionalMatchups.value = [];
      return;
    }

    await getConditionalMatchUps(winnerTeamAbbrev);
  }

  async function getConditionalMatchUps(winnerTeamAbbrev) {
    const requestId = ++conditionalMatchupsRequestId;
    conditionalMatchupsLoading.value = true;
    const gameDate = todaysGame?.value?.startTimeUTC
      ? DateTime.fromISO(todaysGame.value.startTimeUTC)
      : DateTime.now();
    const targetDate = gameDate.plus({ days: 1 }).toFormat('yyyy-MM-dd');
    try {
      const scheduleData = await nhlApi.getSchedule(targetDate);
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
    const upcomingGames = [];
    const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');

    try {
      const scheduleData = await nhlApi.getSchedule(tomorrow);
      const gameWeek = scheduleData?.data?.gameWeek;
      if (!Array.isArray(gameWeek)) {
        possibleMatchUps.value = [];
        potentialLoading.value = false;
        return;
      }

      gameWeek.forEach((date) => {
        (date?.games || []).forEach((game) => {
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
    matchupOptions,
    matchupOptionsLoading,
    selectedWinnerRole,
    conditionalMatchups,
    conditionalMatchupsLoading,
    firstGameNonChampionTeam,
    conditionalMatchupsHeading,
    loadMatchupOptions,
    resetConditionalMatchups,
    handleWinnerSelection,
    getPossibleMatchUps,
  };
}
