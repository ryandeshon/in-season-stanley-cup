const TEAM_ABBREV_ALIASES = Object.freeze({
  WIN: 'WPG',
});

const TIMESTAMP_FIELDS = Object.freeze([
  'savedAt',
  'recordedAt',
  'finalizedAt',
  'updatedAt',
  'createdAt',
  'startTimeUTC',
]);

function normalizeTeamAbbrev(team) {
  const normalized = String(team || '')
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  return TEAM_ABBREV_ALIASES[normalized] || normalized;
}

function toOwnedTeamSet(playerTeams) {
  if (playerTeams instanceof Set) return playerTeams;
  const ownedTeams = new Set();
  (Array.isArray(playerTeams) ? playerTeams : []).forEach((team) => {
    const normalized = normalizeTeamAbbrev(team);
    if (normalized) ownedTeams.add(normalized);
  });
  return ownedTeams;
}

function parseGameId(record) {
  const parsed = Number(record?.id);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGameTimestamp(record) {
  for (const field of TIMESTAMP_FIELDS) {
    const value = record?.[field];
    const parsed = Date.parse(value || '');
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function compareGamesByRecency(a, b) {
  const aId = parseGameId(a);
  const bId = parseGameId(b);

  if (aId !== null && bId !== null && aId !== bId) {
    return bId - aId;
  }

  const aTimestamp = parseGameTimestamp(a);
  const bTimestamp = parseGameTimestamp(b);
  if (
    (aId === null || bId === null || aId === bId) &&
    (aTimestamp !== null || bTimestamp !== null) &&
    aTimestamp !== bTimestamp
  ) {
    return (
      (bTimestamp ?? Number.NEGATIVE_INFINITY) -
      (aTimestamp ?? Number.NEGATIVE_INFINITY)
    );
  }

  const aRaw = String(a?.id ?? '');
  const bRaw = String(b?.id ?? '');
  return bRaw.localeCompare(aRaw);
}

export function sortGamesByRecency(gameRecords) {
  if (!Array.isArray(gameRecords)) return [];
  return [...gameRecords].sort(compareGamesByRecency);
}

export function classifyPlayerGame(game, playerTeams) {
  const ownedTeams = toOwnedTeamSet(playerTeams);
  const winnerTeam = normalizeTeamAbbrev(game?.wTeam);
  const loserTeam = normalizeTeamAbbrev(game?.lTeam);

  const winnerOwned = winnerTeam ? ownedTeams.has(winnerTeam) : false;
  const loserOwned = loserTeam ? ownedTeams.has(loserTeam) : false;

  if (winnerOwned && loserOwned) {
    return {
      classification: 'Mirror',
      playerTeam: null,
      opponentTeam: null,
      winnerTeam,
      loserTeam,
    };
  }

  if (winnerOwned) {
    return {
      classification: 'Win',
      playerTeam: winnerTeam,
      opponentTeam: loserTeam,
      winnerTeam,
      loserTeam,
    };
  }

  if (loserOwned) {
    return {
      classification: 'Loss',
      playerTeam: loserTeam,
      opponentTeam: winnerTeam,
      winnerTeam,
      loserTeam,
    };
  }

  return {
    classification: 'Unknown',
    playerTeam: null,
    opponentTeam: null,
    winnerTeam,
    loserTeam,
  };
}

function toWinPct(wins, losses) {
  const denominator = wins + losses;
  if (!denominator) return null;
  return wins / denominator;
}

function toSummaryRows(summaryMap) {
  return Array.from(summaryMap.entries()).map(([team, entry]) => {
    const wins = entry?.wins || 0;
    const losses = entry?.losses || 0;
    return {
      team,
      wins,
      losses,
      games: wins + losses,
      winPct: toWinPct(wins, losses),
    };
  });
}

export function summarizeLastTenForm(gameRecords, playerTeams) {
  const classifiedGames = sortGamesByRecency(gameRecords)
    .map((game) => classifyPlayerGame(game, playerTeams))
    .filter((result) => result.classification !== 'Unknown')
    .slice(0, 10);

  const totals = {
    wins: 0,
    losses: 0,
    mirrors: 0,
  };

  classifiedGames.forEach((result) => {
    if (result.classification === 'Win') totals.wins += 1;
    if (result.classification === 'Loss') totals.losses += 1;
    if (result.classification === 'Mirror') totals.mirrors += 1;
  });

  return {
    gamesConsidered: classifiedGames.length,
    wins: totals.wins,
    losses: totals.losses,
    mirrors: totals.mirrors,
    winPct: toWinPct(totals.wins, totals.losses),
    record: `${totals.wins}-${totals.losses}-${totals.mirrors}`,
  };
}

export function getBestPerformingTeam(gameRecords, playerTeams) {
  const summaryByTeam = new Map();

  sortGamesByRecency(gameRecords).forEach((game) => {
    const result = classifyPlayerGame(game, playerTeams);
    if (
      !['Win', 'Loss'].includes(result.classification) ||
      !result.playerTeam
    ) {
      return;
    }

    if (!summaryByTeam.has(result.playerTeam)) {
      summaryByTeam.set(result.playerTeam, { wins: 0, losses: 0 });
    }

    const summary = summaryByTeam.get(result.playerTeam);
    if (result.classification === 'Win') summary.wins += 1;
    if (result.classification === 'Loss') summary.losses += 1;
  });

  const rows = toSummaryRows(summaryByTeam).sort((a, b) => {
    if (a.winPct !== b.winPct) {
      return (
        (b.winPct ?? Number.NEGATIVE_INFINITY) -
        (a.winPct ?? Number.NEGATIVE_INFINITY)
      );
    }
    if (a.games !== b.games) return b.games - a.games;
    if (a.wins !== b.wins) return b.wins - a.wins;
    return a.team.localeCompare(b.team);
  });

  return rows[0] || null;
}

export function getWeakestMatchup(gameRecords, playerTeams) {
  const summaryByOpponent = new Map();

  sortGamesByRecency(gameRecords).forEach((game) => {
    const result = classifyPlayerGame(game, playerTeams);
    if (
      !['Win', 'Loss'].includes(result.classification) ||
      !result.playerTeam ||
      !result.opponentTeam
    ) {
      return;
    }

    if (!summaryByOpponent.has(result.opponentTeam)) {
      summaryByOpponent.set(result.opponentTeam, { wins: 0, losses: 0 });
    }

    const summary = summaryByOpponent.get(result.opponentTeam);
    if (result.classification === 'Win') summary.wins += 1;
    if (result.classification === 'Loss') summary.losses += 1;
  });

  const rows = toSummaryRows(summaryByOpponent).sort((a, b) => {
    if (a.winPct !== b.winPct) {
      return (
        (a.winPct ?? Number.POSITIVE_INFINITY) -
        (b.winPct ?? Number.POSITIVE_INFINITY)
      );
    }
    if (a.games !== b.games) return b.games - a.games;
    if (a.losses !== b.losses) return b.losses - a.losses;
    return a.team.localeCompare(b.team);
  });

  return rows[0] || null;
}

export function buildPlayerGameHistory(gameRecords, playerTeams) {
  const ownedTeams = toOwnedTeamSet(playerTeams);
  if (!ownedTeams.size || !Array.isArray(gameRecords)) return [];

  return sortGamesByRecency(
    gameRecords.filter((game) => {
      const winnerTeam = normalizeTeamAbbrev(game?.wTeam);
      const loserTeam = normalizeTeamAbbrev(game?.lTeam);
      return (
        (winnerTeam && ownedTeams.has(winnerTeam)) ||
        (loserTeam && ownedTeams.has(loserTeam))
      );
    })
  );
}

export function getPlayerProfileTrends(gameRecords, playerTeams) {
  return {
    lastTen: summarizeLastTenForm(gameRecords, playerTeams),
    bestTeam: getBestPerformingTeam(gameRecords, playerTeams),
    weakestMatchup: getWeakestMatchup(gameRecords, playerTeams),
  };
}
