import { describe, it, expect } from 'vitest';
import {
  createLocalDraft,
  LOCAL_DRAFT_KEY,
} from '../../src/services/localDraft';
function setup() {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  const draft = createLocalDraft(storage, () => 1000);
  const state = () => draft.request('/draft/state');
  const write = (path, body = {}, method = 'POST') =>
    draft.request(path, {
      method,
      body: { version: state().version, ...body },
    });
  const start = () => write('/draft/state', { draftStarted: true }, 'PATCH');
  return { storage, draft, state, write, start };
}
describe('browser-local draft practice', () => {
  it('completes 32 picks in locked order and persists all four rosters', () => {
    const { draft, storage, state, start, write } = setup();
    start();
    for (let i = 0; i < 32; i++) {
      expect(state().currentPicker).toBe([4, 3, 2, 1][i % 4]);
      write('/draft/pick', {
        playerId: state().currentPicker,
        team: state().availableTeams[0],
      });
    }
    expect(state().availableTeams).toHaveLength(0);
    const restored = createLocalDraft(storage);
    expect(restored.request('/draft/state').pickHistory).toHaveLength(32);
    expect(draft.request('/players').map((p) => p.teams.length)).toEqual([
      8, 8, 8, 8,
    ]);
    expect(
      new Set(draft.request('/players').flatMap((p) => p.teams)).size
    ).toBe(32);
  });
  it('rejects closed, out-of-turn, duplicate, stale, and unsupported writes', () => {
    const { start, write, state } = setup();
    expect(() => write('/draft/pick', { playerId: 4, team: 'ANA' })).toThrow(
      'not open'
    );
    start();
    expect(() => write('/draft/pick', { playerId: 1, team: 'ANA' })).toThrow(
      'another'
    );
    write('/draft/pick', { playerId: 4, team: 'ANA' });
    expect(() => write('/draft/pick', { playerId: 3, team: 'ANA' })).toThrow(
      'unavailable'
    );
    expect(() =>
      write('/draft/pick', { playerId: 3, team: 'BOS', version: 1 })
    ).toThrow('changed');
    expect(() => write('/draft/select-team')).toThrow('Unsupported');
    expect(() =>
      write('/draft/state', { pickOrder: [1, 2, 3, 4] }, 'PATCH')
    ).toThrow('locked');
    expect(state().pickHistory).toHaveLength(1);
  });
  it('supports countdown, locking, undo and reset without reusing a version', () => {
    const { state, write, start, draft } = setup();
    start();
    write(
      '/draft/state',
      { autoPickEnabled: true, autoPickSeconds: 5 },
      'PATCH'
    );
    expect(state().autoPickDeadlineAt).toBe(new Date(6000).toISOString());
    write('/draft/state', { isLocked: true }, 'PATCH');
    expect(state().autoPickDeadlineAt).toBeNull();
    expect(() => write('/draft/pick', { playerId: 4, team: 'ANA' })).toThrow(
      'not open'
    );
    write('/draft/state', { isLocked: false }, 'PATCH');
    write('/draft/pick', { playerId: 4, team: 'ANA' });
    write('/draft/undo-last-pick');
    expect(state().currentPicker).toBe(4);
    expect(draft.request('/players').every((p) => !p.teams.length)).toBe(true);
    const version = state().version;
    write('/players/reset-teams');
    expect(state().version).toBe(version + 1);
    expect(state().draftStarted).toBe(false);
    expect(state().pickOrder).toEqual([4, 3, 2, 1]);
  });
  it('fails closed if browser storage is unavailable or corrupt', () => {
    const draft = createLocalDraft({
      getItem() {
        throw Error('Storage blocked');
      },
    });
    expect(() => draft.request('/draft/state')).toThrow('Storage blocked');
    const { storage, state } = setup();
    storage.setItem(LOCAL_DRAFT_KEY, 'invalid');
    expect(state).toThrow();
  });
});
