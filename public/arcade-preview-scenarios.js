/* Shared by the isolated local server and hosted preview service worker. */
(function (root) {
  function applyPreviewScenario(state, original, scenario) {
    if (!['off-day', 'empty-schedule', 'pregame', 'live'].includes(scenario))
      throw Error('Unknown preview scenario');
    for (const key of [
      'gameIdResponse',
      'gameInfoResponse',
      'scheduleResponse',
    ])
      state[key] = structuredClone(original[key]);
    state.previewScenario = scenario;
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(23, 0, 0, 0);
    state.scheduleResponse.gameWeek.forEach((day, index) => {
      const date = new Date(tomorrow);
      date.setUTCDate(date.getUTCDate() + index);
      day.date = date.toISOString().slice(0, 10);
      day.games.forEach((game) => {
        game.startTimeUTC = date.toISOString();
      });
    });
    if (scenario === 'off-day' || scenario === 'empty-schedule') {
      state.gameIdResponse = { gameID: null, message: 'No Cup defense today' };
      if (scenario === 'empty-schedule') state.scheduleResponse.gameWeek = [];
    } else if (scenario === 'pregame') {
      const game = state.gameInfoResponse;
      game.gameState = 'FUT';
      game.startTimeUTC = tomorrow.toISOString();
      game.homeTeam.score = 0;
      game.awayTeam.score = 0;
      game.clock = {
        timeRemaining: '20:00',
        secondsRemaining: 1200,
        running: false,
        inIntermission: false,
      };
      game.periodDescriptor = { number: 1, periodType: 'REG' };
      delete game.gameOutcome;
    }
  }
  if (typeof module !== 'undefined') module.exports = applyPreviewScenario;
  else root.applyPreviewScenario = applyPreviewScenario;
})(typeof self !== 'undefined' ? self : globalThis);
