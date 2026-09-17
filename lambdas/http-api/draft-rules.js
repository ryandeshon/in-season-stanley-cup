export function createDraftRules({
  DEFAULT_DRAFT_STATE,
  MAX_AUTO_PICK_SECONDS,
  NHL_TEAMS,
}) {
  function coerceId(value) {
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? value : asNumber;
  }

  function parseAutoPickSeconds(value, fallback = 60) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, MAX_AUTO_PICK_SECONDS);
  }

  function parseDraftStateVersion(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
  }

  function normalizeIsoDate(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }

  function shouldDisableAutoPick(state) {
    if (!state.autoPickEnabled) return true;
    if (!state.draftStarted) return true;
    if (
      state.currentPicker === null ||
      state.currentPicker === undefined ||
      state.currentPicker === ''
    )
      return true;
    if (state.isLocked) return true;
    if (
      !Array.isArray(state.availableTeams) ||
      state.availableTeams.length === 0
    ) {
      return true;
    }
    return (
      !Number.isInteger(state.autoPickSeconds) || state.autoPickSeconds <= 0
    );
  }

  function getNextAutoPickDeadline(state, now = Date.now()) {
    if (shouldDisableAutoPick(state)) return null;
    return new Date(now + state.autoPickSeconds * 1000).toISOString();
  }

  function normalizePickHistoryEntry(entry = {}) {
    if (!entry || typeof entry !== 'object') return null;
    const team = String(entry.team || '')
      .trim()
      .toUpperCase();
    const rawPlayerId = entry.playerId;
    const hasPlayerId =
      rawPlayerId !== undefined && rawPlayerId !== null && rawPlayerId !== '';
    if (!team || !hasPlayerId) return null;

    const pickNumberRaw = Number(entry.pickNumber);
    const pickNumber =
      Number.isInteger(pickNumberRaw) && pickNumberRaw > 0
        ? pickNumberRaw
        : null;

    return {
      playerId: coerceId(rawPlayerId),
      team,
      pickNumber,
      pickedAt: normalizeIsoDate(entry.pickedAt),
    };
  }

  function normalizePickHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.map(normalizePickHistoryEntry).filter(Boolean);
  }

  function normalizeDraftState(state = {}, options = {}) {
    const nowIso = options.nowIso || new Date().toISOString();
    const normalized = {
      ...DEFAULT_DRAFT_STATE,
      ...state,
    };

    if (!Array.isArray(normalized.pickOrder)) {
      normalized.pickOrder = [];
    }
    if (!Array.isArray(normalized.availableTeams)) {
      normalized.availableTeams = [...NHL_TEAMS];
    }

    normalized.currentPicker =
      normalized.currentPicker === undefined ? null : normalized.currentPicker;
    normalized.currentPickNumber = Number.isInteger(
      Number(normalized.currentPickNumber)
    )
      ? Number(normalized.currentPickNumber)
      : 0;
    normalized.version = Number.isInteger(Number(normalized.version))
      ? Math.max(0, Number(normalized.version))
      : 0;
    normalized.draftStarted = Boolean(normalized.draftStarted);
    normalized.isLocked = Boolean(normalized.isLocked);
    normalized.autoPickEnabled = Boolean(normalized.autoPickEnabled);
    normalized.autoPickSeconds = parseAutoPickSeconds(
      normalized.autoPickSeconds
    );
    normalized.pickHistory = normalizePickHistory(normalized.pickHistory);
    normalized.updatedAt = normalizeIsoDate(normalized.updatedAt) || nowIso;

    const normalizedDeadline = normalizeIsoDate(normalized.autoPickDeadlineAt);
    if (shouldDisableAutoPick(normalized)) {
      normalized.autoPickDeadlineAt = null;
    } else {
      normalized.autoPickDeadlineAt = normalizedDeadline;
    }

    return normalized;
  }

  function shouldRefreshAutoPickDeadline(patch = {}) {
    const deadlineTriggers = [
      'draftStarted',
      'currentPicker',
      'isLocked',
      'availableTeams',
      'autoPickEnabled',
      'autoPickSeconds',
    ];
    return deadlineTriggers.some((key) =>
      Object.prototype.hasOwnProperty.call(patch, key)
    );
  }

  function normalizeDraftTeam(team) {
    const normalized = String(team || '')
      .trim()
      .toUpperCase();
    return normalized || null;
  }

  function getNextPicker(pickOrder = [], currentPicker) {
    if (!Array.isArray(pickOrder) || pickOrder.length === 0) return null;
    const currentIndex = pickOrder.findIndex(
      (entry) => coerceId(entry) === coerceId(currentPicker)
    );
    if (currentIndex < 0) return null;
    const nextIndex = (currentIndex + 1) % pickOrder.length;
    return pickOrder[nextIndex];
  }

  function mapPlayerWithTeams(player, teams, updatedAt) {
    return {
      ...(player || {}),
      teams,
      updatedAt,
    };
  }
  return {
    coerceId,
    parseAutoPickSeconds,
    parseDraftStateVersion,
    normalizeIsoDate,
    shouldDisableAutoPick,
    getNextAutoPickDeadline,
    normalizePickHistoryEntry,
    normalizePickHistory,
    normalizeDraftState,
    shouldRefreshAutoPickDeadline,
    normalizeDraftTeam,
    getNextPicker,
    mapPlayerWithTeams,
  };
}
