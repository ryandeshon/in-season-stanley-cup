// Test-only practice state. No API or database fallback is permitted.
export const LOCAL_DRAFT_KEY = 'inseason-local-draft-v1';
const order = [4, 3, 2, 1];
const teams =
  'ANA BOS BUF CGY CAR CHI COL CBJ DAL DET EDM FLA LAK MIN MTL NSH NJD NYI NYR OTT PHI PIT SJS SEA STL TBL TOR UTA VAN VGK WSH WPG'.split(
    ' '
  );
function fresh(version = 0) {
  return {
    players: ['Ryan', 'Cooper', 'Boz', 'Terry'].map((name, i) => ({
      id: i + 1,
      name,
      teams: [],
    })),
    state: {
      version,
      pickOrder: [...order],
      pickOrderLocked: true,
      currentPicker: 4,
      currentPickNumber: 1,
      draftStarted: false,
      isLocked: false,
      availableTeams: [...teams],
      pickHistory: [],
      autoPickEnabled: false,
      autoPickSeconds: 60,
      autoPickDeadlineAt: null,
    },
  };
}
function fail(message, status = 400, currentState) {
  throw Object.assign(new Error(message), {
    status,
    details: { error: message, currentState },
  });
}
export function createLocalDraft(storage, now = Date.now) {
  function read() {
    const saved = storage.getItem(LOCAL_DRAFT_KEY);
    return saved ? JSON.parse(saved) : fresh();
  }
  function request(path, { method = 'GET', body = {} } = {}) {
    let data = read();
    const state = data.state;
    if (method === 'GET') {
      if (path === '/seasons')
        return {
          storageVersion: 'v2',
          defaultSeason: 'season3',
          seasons: [
            {
              id: 'season3',
              label: 'Season 3',
              status: 'preseason',
              writersEnabled: true,
            },
          ],
        };
      if (path === '/season/meta')
        return { seasonId: 'season3', seasonOver: false };
      if (path === '/players') return data.players;
      if (path.startsWith('/players/'))
        return (
          data.players.find(
            (p) => p.name === decodeURIComponent(path.slice(9))
          ) || fail('Unknown player', 404)
        );
      if (path === '/draft/state') return state;
      if (path === '/game-records') return [];
      return fail('Unsupported local practice request', 404);
    }
    if (
      ![
        'PATCH /draft/state',
        'POST /draft/pick',
        'POST /draft/undo-last-pick',
        'POST /players/reset-teams',
      ].includes(`${method} ${path}`)
    )
      fail('Unsupported local practice action', 405);
    if (!Number.isInteger(body.version) || body.version !== state.version)
      fail('Draft changed. Refresh and try again.', 409, state);
    let undonePick;
    if (path === '/players/reset-teams') data = fresh(state.version);
    else if (path === '/draft/state') {
      if (
        body.pickOrder &&
        JSON.stringify(body.pickOrder) !== JSON.stringify(order)
      )
        fail('Draft order is locked');
      if (body.draftStarted !== undefined) {
        if (state.draftStarted || body.draftStarted !== true)
          fail('Use Reset to start a new practice');
        state.draftStarted = true;
      }
      if (body.isLocked !== undefined) state.isLocked = Boolean(body.isLocked);
      if (body.autoPickEnabled !== undefined)
        state.autoPickEnabled = Boolean(body.autoPickEnabled);
      if (body.autoPickSeconds !== undefined) {
        if (
          !Number.isInteger(body.autoPickSeconds) ||
          body.autoPickSeconds < 5 ||
          body.autoPickSeconds > 600
        )
          fail('Countdown must be 5–600 seconds');
        state.autoPickSeconds = body.autoPickSeconds;
      }
    } else if (path === '/draft/pick') {
      if (!state.draftStarted || state.isLocked) fail('Draft is not open');
      if (Number(body.playerId) !== state.currentPicker)
        fail('It is another player’s turn');
      if (!state.availableTeams.includes(body.team))
        fail('Team is unavailable');
      data.players
        .find((p) => p.id === state.currentPicker)
        .teams.push(body.team);
      state.availableTeams = state.availableTeams.filter(
        (t) => t !== body.team
      );
      state.pickHistory.push({
        playerId: state.currentPicker,
        team: body.team,
        pickNumber: state.currentPickNumber,
        pickedAt: new Date(now()).toISOString(),
      });
      state.currentPickNumber++;
      state.currentPicker = order[(state.currentPickNumber - 1) % order.length];
    } else {
      undonePick = state.pickHistory.pop();
      if (!undonePick) fail('There is no pick to undo');
      const player = data.players.find((p) => p.id === undonePick.playerId);
      player.teams = player.teams.filter((t) => t !== undonePick.team);
      state.availableTeams = teams.filter(
        (t) => !state.pickHistory.some((p) => p.team === t)
      );
      state.currentPicker = undonePick.playerId;
      state.currentPickNumber = undonePick.pickNumber;
    }
    data.state.version++;
    data.state.autoPickDeadlineAt =
      data.state.draftStarted &&
      !data.state.isLocked &&
      data.state.autoPickEnabled &&
      data.state.availableTeams.length
        ? new Date(now() + data.state.autoPickSeconds * 1000).toISOString()
        : null;
    storage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(data));
    return path === '/draft/state'
      ? data.state
      : { state: data.state, undonePick };
  }
  return { request };
}
export async function localDraftRequest(path, options = {}) {
  const store = createLocalDraft(window.localStorage);
  if (!options.method || options.method === 'GET')
    return store.request(path, options);
  if (!navigator.locks)
    fail('Local practice requires a browser with Web Locks support');
  return navigator.locks.request(LOCAL_DRAFT_KEY, () => {
    const result = store.request(path, options);
    window.dispatchEvent(new Event('local-draft-update'));
    return result;
  });
}
export function subscribeLocalDraft(callback) {
  const update = () =>
    callback({
      type: 'draftUpdate',
      payload: createLocalDraft(window.localStorage).request('/draft/state'),
    });
  const storage = (event) => {
    if (event.key === LOCAL_DRAFT_KEY || event.key === null) update();
  };
  window.addEventListener('storage', storage);
  window.addEventListener('local-draft-update', update);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener('local-draft-update', update);
  };
}
