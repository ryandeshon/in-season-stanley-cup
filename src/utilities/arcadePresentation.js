const finalStates = ['FINAL', 'OFF'];
const liveStates = ['LIVE', 'CRIT'];
const validScore = (score) => Number.isInteger(score) && score >= 0;

export function getPresentationResult(game = {}) {
  const home = game?.homeTeam;
  const away = game?.awayTeam;
  if (
    !finalStates.includes(game?.gameState) ||
    !validScore(home?.score) ||
    !validScore(away?.score) ||
    home.score === away.score
  )
    return null;
  const winner = home.score > away.score ? home : away;
  const loser = winner === home ? away : home;
  const decision =
    game.gameOutcome?.lastPeriodType ||
    game.periodDescriptor?.periodType ||
    null;
  return {
    winner,
    loser,
    decision,
    flawless: loser.score === 0 && ['REG', 'OT'].includes(decision),
    signature: `${game.id}:${winner.abbrev}:${home.score}:${away.score}:${decision}`,
  };
}

// Store scalar snapshots so mutating a feed object cannot rewrite the baseline.
// Presentation events never write game state, ownership or standings.
export function createArenaTracker(played = new Set()) {
  let previous = null;
  return (game, { season, now = Date.now(), suspended = false } = {}) => {
    const result = getPresentationResult(game);
    const next = {
      key: `${season}:${game?.id}`,
      state: game?.gameState,
      scores: [game?.homeTeam?.score, game?.awayTeam?.score],
      signature: result?.signature,
      intermission: game?.clock?.inIntermission,
      at: now,
      suspended,
    };
    const before = previous;
    previous = next;
    const settle = (cancel = false) => ({ type: 'settle', result, cancel });
    if (!game?.id || !before || before.key !== next.key) {
      if (finalStates.includes(next.state)) played.add(next.key);
      return settle(true);
    }
    if (finalStates.includes(next.state)) {
      const witnessed =
        liveStates.includes(before.state) &&
        !suspended &&
        !before.suspended &&
        now - before.at <= 45000;
      const canPlay = result && witnessed && !played.has(next.key);
      played.add(next.key);
      return canPlay
        ? { type: 'finish', result }
        : settle(before.signature !== next.signature);
    }
    if (
      suspended ||
      before.suspended ||
      now - before.at > 45000 ||
      !liveStates.includes(next.state) ||
      !liveStates.includes(before.state) ||
      next.intermission ||
      before.intermission
    )
      return settle(true);
    if (![...before.scores, ...next.scores].every(validScore))
      return settle(true);
    const changes = next.scores.map((s, i) => s - before.scores[i]);
    if (changes.some((n) => n < 0) || changes.filter((n) => n > 0).length > 1)
      return settle(true);
    if (changes.every((n) => n === 0)) return settle();
    // At most one cue per observed update; never invent a multi-goal sequence.
    return {
      type: 'goal',
      team: changes[0] > 0 ? game.homeTeam.abbrev : game.awayTeam.abbrev,
      result,
    };
  };
}
