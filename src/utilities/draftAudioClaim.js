const key = 'inseason-draft-audio-events-v1';
// Coordinate visible draft windows without contacting the server. Keep a small
// recent history so duplicate HTTP/live updates cannot replay the same pick.
export async function claimDraftPickAudio(eventId, browser = window) {
  if (!browser.navigator.locks) return browser.document.hasFocus();
  try {
    return await browser.navigator.locks.request(key, () => {
      const recent = JSON.parse(browser.localStorage.getItem(key) || '[]');
      if (recent.includes(eventId)) return false;
      browser.localStorage.setItem(
        key,
        JSON.stringify([...recent.slice(-63), eventId])
      );
      return true;
    });
  } catch {
    // If coordination storage is blocked, only the focused window may play.
    return browser.document.hasFocus();
  }
}
