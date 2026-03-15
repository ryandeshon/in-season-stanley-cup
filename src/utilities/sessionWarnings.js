const inMemorySessionWarnings = new Set();

function hasWindowSessionStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

export function hasSessionWarning(key) {
  if (!key) return false;
  if (!hasWindowSessionStorage()) {
    return inMemorySessionWarnings.has(key);
  }
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return inMemorySessionWarnings.has(key);
  }
}

export function setSessionWarning(key) {
  if (!key) return;
  if (!hasWindowSessionStorage()) {
    inMemorySessionWarnings.add(key);
    return;
  }
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    inMemorySessionWarnings.add(key);
  }
}

export function warnOncePerSession(key, message) {
  if (!key || !message || hasSessionWarning(key)) return false;
  setSessionWarning(key);
  console.warn(message);
  return true;
}
