// Helpers for consistent API stubbing across scenarios
Cypress.Commands.add('mockApiScenario', (fixtureName = 'cup-day-multiple-games') => {
  cy.fixture(fixtureName).then((data) => {
    const {
      championResponse,
      championStatus = 200,
      gameIdResponse,
      gameIdStatus = 200,
      seasonMetaResponse = {
        seasonId: 'season2',
        seasonOver: false,
        regularSeasonEnd: null,
        playoffsStart: null,
      },
      seasonMetaStatus = 200,
      seasonOptionsResponse = {
        defaultSeason: 'season2',
        seasons: [
          { id: 'season1', label: '1' },
          { id: 'season2', label: '2' },
        ],
      },
      seasonOptionsStatus = 200,
      championHistoryResponse = {
        seasonId: 'season2',
        limit: 6,
        history: [],
      },
      championHistoryStatus = 200,
      playersResponse = [],
      gameRecordsResponse = [],
      gameInfoResponse = {},
      gameInfoStatus = 200,
      scheduleResponse = { gameWeek: [] },
      scheduleStatus = 200,
    } = data;

    cy.intercept('GET', '**/season/options*', {
      statusCode: seasonOptionsStatus,
      body: seasonOptionsResponse,
    }).as('getSeasonOptions');

    cy.intercept('GET', '**/champion*', {
      statusCode: championStatus,
      body: championResponse,
    }).as('getChampion');

    cy.intercept('GET', '**/gameid*', {
      statusCode: gameIdStatus,
      body: gameIdResponse,
    }).as('getGameId');

    cy.intercept('GET', '**/season/meta*', {
      statusCode: seasonMetaStatus,
      body: seasonMetaResponse,
    }).as('getSeasonMeta');

    cy.intercept('GET', '**/champion/history*', {
      statusCode: championHistoryStatus,
      body: championHistoryResponse,
    }).as('getChampionHistory');

    cy.intercept('GET', '**/players*', (req) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const playersIndex = pathParts.lastIndexOf('players');
      const requestedPlayerName =
        playersIndex >= 0 && pathParts.length > playersIndex + 1
          ? decodeURIComponent(pathParts[playersIndex + 1])
          : null;

      if (requestedPlayerName) {
        const matchedPlayer = playersResponse.find(
          (player) =>
            String(player?.name || '').toLowerCase() ===
            requestedPlayerName.toLowerCase()
        );
        req.reply({
          statusCode: 200,
          body: matchedPlayer || null,
        });
        return;
      }

      req.reply({
        statusCode: 200,
        body: playersResponse,
      });
    }).as('getPlayers');

    cy.intercept('GET', '**/game-records*', {
      statusCode: 200,
      body: gameRecordsResponse,
    }).as('getGameRecords');

    cy.intercept('GET', '**/gamecenter/**/boxscore', (req) => {
      req.reply({
        statusCode: gameInfoStatus,
        body: gameInfoResponse,
      });
    }).as('getGameInfo');

    cy.intercept('GET', '**/schedule/**', {
      statusCode: scheduleStatus,
      body: scheduleResponse,
    }).as('getSchedule');
  });
});

Cypress.Commands.add('mockDraftScenario', (fixtureName = 'draft-default') => {
  cy.fixture(fixtureName).then((data) => {
    let players = Array.isArray(data.players) ? [...data.players] : [];
    let state = data.draftState || {
      draftStarted: false,
      pickOrder: [],
      currentPicker: null,
      currentPickNumber: 0,
      availableTeams: [],
      version: 0,
    };

    const seasonMetaResponse = data.seasonMetaResponse || {
      seasonId: 'season2',
      seasonOver: true,
      regularSeasonEnd: null,
      playoffsStart: null,
    };
    const seasonMetaStatus = data.seasonMetaStatus || 200;
    const seasonOptionsResponse = data.seasonOptionsResponse || {
      defaultSeason: 'season2',
      seasons: [
        { id: 'season1', label: '1' },
        { id: 'season2', label: '2' },
      ],
    };
    const seasonOptionsStatus = data.seasonOptionsStatus || 200;

    cy.intercept('GET', '**/season/options*', {
      statusCode: seasonOptionsStatus,
      body: seasonOptionsResponse,
    }).as('getSeasonOptions');

    cy.intercept('GET', '**/season/meta*', {
      statusCode: seasonMetaStatus,
      body: seasonMetaResponse,
    }).as('getSeasonMeta');

    cy.intercept('GET', '**/players*', {
      statusCode: 200,
      body: players,
    }).as('getDraftPlayers');

    cy.intercept('GET', '**/draft/state*', (req) => {
      req.reply({
        statusCode: 200,
        body: state,
      });
    }).as('getDraftState');

    cy.intercept('PATCH', '**/draft/state*', (req) => {
      const expectedVersion = Number(req.body?.version);
      if (!Number.isInteger(expectedVersion)) {
        req.reply({
          statusCode: 400,
          body: { error: 'version is required' },
        });
        return;
      }

      if (expectedVersion !== state.version) {
        req.reply({
          statusCode: 409,
          body: {
            error: 'Draft state version conflict',
            currentVersion: state.version,
            currentState: state,
          },
        });
        return;
      }

      const { version: _ignoredVersion, ...patch } = req.body || {};
      state = {
        ...state,
        ...patch,
        version: state.version + 1,
      };

      req.reply({
        statusCode: 200,
        body: state,
      });
    }).as('patchDraftState');

    cy.intercept('POST', '**/draft/select-team*', (req) => {
      const playerId = Number(req.body?.playerId);
      const team = req.body?.team;
      players = players.map((player) => {
        if (Number(player.id) !== playerId) return player;
        const nextTeams = Array.isArray(player.teams) ? [...player.teams] : [];
        if (!nextTeams.includes(team)) {
          nextTeams.push(team);
        }
        return {
          ...player,
          teams: nextTeams,
        };
      });
      const player = players.find((p) => Number(p.id) === playerId) || null;
      req.reply({
        statusCode: 200,
        body: {
          player,
          team,
        },
      });
    }).as('selectDraftTeam');

    cy.intercept('POST', '**/players/reset-teams*', () => {
      players = players.map((player) => ({
        ...player,
        teams: [],
      }));
      return {
        statusCode: 200,
        body: { ok: true },
      };
    }).as('resetDraftTeams');
  });
});
