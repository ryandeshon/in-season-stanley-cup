import { describe, it, expect } from 'vitest';
import {
  createArenaTracker,
  getPresentationResult,
} from '@/utilities/arcadePresentation';
const game = (state = 'LIVE', home = 2, away = 1, decision = 'REG') => ({
  id: 71,
  gameState: state,
  homeTeam: { abbrev: 'BOS', score: home },
  awayTeam: { abbrev: 'TOR', score: away },
  periodDescriptor: { periodType: decision },
  clock: { inIntermission: false },
});
describe('arcade result classification', () => {
  it.each(['FINAL', 'OFF'])(
    'awards confirmed regulation and overtime shutouts in %s',
    (state) => {
      expect(getPresentationResult(game(state, 3, 0)).flawless).toBe(true);
      expect(getPresentationResult(game(state, 0, 1, 'OT')).winner.abbrev).toBe(
        'TOR'
      );
      expect(getPresentationResult(game(state, 0, 1, 'OT')).flawless).toBe(
        true
      );
    }
  );
  it.each([
    ['LIVE', 3, 0],
    ['FINAL', 0, 0],
    ['FINAL', 2, 2],
    ['FINAL', null, 0],
    ['FINAL', 3, -1],
    ['FINAL', NaN, 0],
    ['FINAL', 1.2, 0],
    ['FINAL', '3', 0],
  ])('rejects invalid result %s %s %s', (s, h, a) =>
    expect(getPresentationResult(game(s, h, a))).toBeNull()
  );
  it('requires confirmed decision metadata and excludes shootouts', () => {
    expect(getPresentationResult(game('FINAL', 1, 0, 'SO')).flawless).toBe(
      false
    );
    expect(getPresentationResult(game('FINAL', 1, 0, null)).flawless).toBe(
      false
    );
    const final = game('FINAL', 1, 0);
    final.gameOutcome = { lastPeriodType: 'SO' };
    expect(getPresentationResult(final).flawless).toBe(false);
  });
});
describe('arcade event playback', () => {
  it('baselines, ignores repeats and emits at most one attack for a score jump', () => {
    const track = createArenaTracker();
    expect(track(game()).type).toBe('settle');
    expect(track(game()).type).toBe('settle');
    expect(track(game('LIVE', 5, 1))).toMatchObject({
      type: 'goal',
      team: 'BOS',
    });
    expect(track(game('LIVE', 5, 2))).toMatchObject({
      type: 'goal',
      team: 'TOR',
    });
  });
  it('cancels corrections and ambiguous simultaneous changes', () => {
    const track = createArenaTracker();
    track(game());
    expect(track(game('LIVE', 1, 1))).toMatchObject({
      type: 'settle',
      cancel: true,
    });
    expect(track(game('LIVE', 2, 2))).toMatchObject({
      type: 'settle',
      cancel: true,
    });
  });
  it('suppresses catch-up after disconnect, long gaps, hidden tabs and intermission', () => {
    const track = createArenaTracker();
    track(game(), { now: 0 });
    expect(track(game('LIVE', 3, 1), { now: 50000 }).type).toBe('settle');
    expect(
      track(game('LIVE', 4, 1), { now: 51000, suspended: true }).type
    ).toBe('settle');
    expect(track(game('LIVE', 5, 1), { now: 52000 }).type).toBe('settle');
    const intermission = game('LIVE', 6, 1);
    intermission.clock.inIntermission = true;
    expect(track(intermission, { now: 53000 }).type).toBe('settle');
    expect(track(game('LIVE', 7, 1), { now: 54000 }).type).toBe('settle');
    expect(track(game('LIVE', 8, 1), { now: 55000 }).type).toBe('goal');
  });
  it('plays final once, preserves animation across identical polls and cancels corrected results', () => {
    const played = new Set(),
      track = createArenaTracker(played);
    track(game());
    expect(track(game('FINAL')).type).toBe('finish');
    expect(track(game('OFF'))).toMatchObject({ type: 'settle', cancel: false });
    expect(track(game('OFF', 0, 3))).toMatchObject({
      type: 'settle',
      cancel: true,
      result: { winner: { abbrev: 'TOR' }, flawless: true },
    });
    track(game());
    expect(track(game('FINAL')).type).toBe('settle');
    const remount = createArenaTracker(played);
    remount(game());
    expect(remount(game('FINAL')).type).toBe('settle');
  });
  it('never auto-plays archived finals and isolates season/game latches', () => {
    const track = createArenaTracker();
    expect(track(game('FINAL'), { season: 'season2' }).type).toBe('settle');
    track(game(), { season: 'season2' });
    expect(track(game('FINAL'), { season: 'season2' }).type).toBe('settle');
    track(game(), { season: 'season3' });
    expect(track(game('FINAL'), { season: 'season3' }).type).toBe('finish');
  });
  it('keeps a snapshot baseline when callers mutate their feed object', () => {
    const track = createArenaTracker(),
      value = game();
    track(value);
    value.homeTeam.score++;
    expect(track(value)).toMatchObject({ type: 'goal', team: 'BOS' });
  });
});
