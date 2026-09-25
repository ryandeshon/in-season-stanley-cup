import { expect, it } from 'vitest';
import { claimDraftPickAudio } from '@/utilities/draftAudioClaim';
it('allows exactly one of several draft windows to announce a pick', async () => {
  const values = new Map();
  let queue = Promise.resolve();
  const locks = {
    request(_key, action) {
      const result = queue.then(action);
      queue = result.catch(() => {});
      return result;
    },
  };
  const browser = {
    navigator: { locks },
    localStorage: {
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    },
  };
  expect(
    await Promise.all(
      [1, 2, 3, 4].map(() => claimDraftPickAudio('pick-1', browser))
    )
  ).toEqual([true, false, false, false]);
  expect(await claimDraftPickAudio('pick-1', browser)).toBe(false);
  expect(await claimDraftPickAudio('pick-2', browser)).toBe(true);
});
it('uses only the focused window if coordination is unavailable', async () => {
  expect(
    await claimDraftPickAudio('pick', {
      navigator: {},
      document: { hasFocus: () => false },
    })
  ).toBe(false);
  expect(
    await claimDraftPickAudio('pick', {
      navigator: {},
      document: { hasFocus: () => true },
    })
  ).toBe(true);
});
