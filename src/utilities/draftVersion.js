// Keep both draft screens on the same optimistic-concurrency contract.
export function requireDraftVersion(state) {
  const version = Number(state?.version);
  if (!Number.isInteger(version) || version < 0) {
    throw new Error('Draft state version is unavailable. Refresh and retry.');
  }
  return version;
}

// Polls and socket messages can finish out of order; versions never move backward.
export function canApplyDraftState(current, incoming) {
  if (!incoming) return false;
  const previousVersion = Number(current?.version);
  const nextVersion = Number(incoming.version);
  return (
    !Number.isInteger(previousVersion) ||
    !Number.isInteger(nextVersion) ||
    nextVersion >= previousVersion
  );
}
