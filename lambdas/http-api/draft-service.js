export function createDraftService({
  DEFAULT_DRAFT_STATE,
  DRAFT_STATE_ID,
  DraftStateConflictError,
  DraftStateValidationError,
  GAME_OPTIONS_TABLE,
  NHL_TEAMS,
  coerceId,
  dynamoDB,
  getNextAutoPickDeadline,
  getNextPicker,
  getPlayerById,
  mapPlayerWithTeams,
  normalizeDraftState,
  normalizeDraftTeam,
  normalizeIsoDate,
  normalizePickHistory,
  parseDraftStateVersion,
  shouldDisableAutoPick,
  shouldRefreshAutoPickDeadline,
}) {
  async function ensureDraftState() {
    const res = await dynamoDB
      .get({
        TableName: GAME_OPTIONS_TABLE,
        Key: { id: DRAFT_STATE_ID },
        ConsistentRead: true,
      })
      .promise();
    if (res.Item?.state) {
      const state = normalizeDraftState(
        {
          ...res.Item.state,
          updatedAt: res.Item.state.updatedAt || res.Item.updatedAt,
        },
        {
          nowIso: new Date().toISOString(),
        }
      );

      const needsNormalization =
        typeof res.Item.state.isLocked !== 'boolean' ||
        typeof res.Item.state.autoPickEnabled !== 'boolean' ||
        !Number.isInteger(Number(res.Item.state.autoPickSeconds)) ||
        !Array.isArray(res.Item.state.pickHistory) ||
        !Array.isArray(res.Item.state.availableTeams) ||
        !Number.isInteger(Number(res.Item.state.version)) ||
        !res.Item.state.updatedAt ||
        normalizeIsoDate(res.Item.state.autoPickDeadlineAt || null) !==
          state.autoPickDeadlineAt;
      if (needsNormalization) {
        const now = new Date().toISOString();
        state.updatedAt = now;
        await dynamoDB
          .update({
            TableName: GAME_OPTIONS_TABLE,
            Key: { id: DRAFT_STATE_ID },
            UpdateExpression: 'SET #state = :state, #updatedAt = :ts',
            ExpressionAttributeNames: {
              '#state': 'state',
              '#updatedAt': 'updatedAt',
            },
            ExpressionAttributeValues: {
              ':state': state,
              ':ts': now,
            },
          })
          .promise();
      }
      return state;
    }

    const state = {
      ...normalizeDraftState(
        {
          ...DEFAULT_DRAFT_STATE,
          availableTeams: [...NHL_TEAMS],
        },
        {
          nowIso: new Date().toISOString(),
        }
      ),
      version: 0,
    };

    await dynamoDB
      .put({
        TableName: GAME_OPTIONS_TABLE,
        Item: {
          id: DRAFT_STATE_ID,
          state,
          updatedAt: state.updatedAt,
        },
      })
      .promise();

    return state;
  }

  function getDraftStateVersionCondition() {
    return '(attribute_not_exists(#state.#version) AND :expected = :zero) OR #state.#version = :expected';
  }

  function buildDraftStateVersionedWrite(nextState, expectedVersion) {
    return {
      TableName: GAME_OPTIONS_TABLE,
      Key: { id: DRAFT_STATE_ID },
      UpdateExpression: 'SET #state = :state, #updatedAt = :ts',
      ConditionExpression: getDraftStateVersionCondition(),
      ExpressionAttributeNames: {
        '#state': 'state',
        '#version': 'version',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':state': nextState,
        ':ts': nextState.updatedAt,
        ':expected': expectedVersion,
        ':zero': 0,
      },
    };
  }

  async function updateDraftState(patch = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new DraftStateValidationError('patch body must be an object');
    }
    if (patch.version === undefined) {
      throw new DraftStateValidationError('version is required');
    }
    const expectedVersion = parseDraftStateVersion(patch.version);
    if (expectedVersion === null) {
      throw new DraftStateValidationError(
        'version must be a non-negative integer'
      );
    }

    const current = await ensureDraftState();
    if (expectedVersion !== current.version) {
      throw new DraftStateConflictError(
        'Draft state version conflict',
        current
      );
    }

    const patchWithoutVersion = { ...patch };
    delete patchWithoutVersion.version;
    delete patchWithoutVersion.updatedAt;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const next = normalizeDraftState(
      {
        ...current,
        ...patchWithoutVersion,
        updatedAt: nowIso,
      },
      {
        nowIso,
      }
    );

    if (shouldDisableAutoPick(next)) {
      next.autoPickDeadlineAt = null;
    } else if (shouldRefreshAutoPickDeadline(patchWithoutVersion)) {
      next.autoPickDeadlineAt = getNextAutoPickDeadline(next, now);
    } else if (!next.autoPickDeadlineAt) {
      next.autoPickDeadlineAt = getNextAutoPickDeadline(next, now);
    }

    next.version = current.version + 1;

    try {
      await dynamoDB
        .update(buildDraftStateVersionedWrite(next, expectedVersion))
        .promise();
    } catch (err) {
      if (err?.code === 'ConditionalCheckFailedException') {
        const latest = await ensureDraftState();
        throw new DraftStateConflictError(
          'Draft state version conflict',
          latest
        );
      }
      throw err;
    }

    return next;
  }

  async function makeDraftPick({ playerId, team, version, playersTable }) {
    const expectedVersion = parseDraftStateVersion(version);
    if (expectedVersion === null) {
      throw new DraftStateValidationError(
        'version must be a non-negative integer'
      );
    }

    const normalizedPlayerId = coerceId(playerId);
    const normalizedTeam = normalizeDraftTeam(team);
    if (!normalizedTeam) {
      throw new DraftStateValidationError('team is required');
    }

    const current = await ensureDraftState();
    if (expectedVersion !== current.version) {
      throw new DraftStateConflictError(
        'Draft state version conflict',
        current
      );
    }
    if (!current.draftStarted) {
      throw new DraftStateValidationError('Draft has not started');
    }
    if (current.isLocked) {
      throw new DraftStateValidationError('Draft is locked');
    }
    if (!Array.isArray(current.pickOrder) || current.pickOrder.length === 0) {
      throw new DraftStateValidationError('Draft pick order is not configured');
    }
    if (coerceId(current.currentPicker) !== normalizedPlayerId) {
      throw new DraftStateValidationError("It is not this player's turn");
    }
    if (
      !Array.isArray(current.availableTeams) ||
      !current.availableTeams.includes(normalizedTeam)
    ) {
      throw new DraftStateValidationError('Team is no longer available');
    }

    const player = await getPlayerById(normalizedPlayerId, playersTable);
    if (!player) {
      throw new DraftStateValidationError(
        `Player ${normalizedPlayerId} was not found`
      );
    }

    const existingTeams = Array.isArray(player.teams) ? [...player.teams] : [];
    if (existingTeams.includes(normalizedTeam)) {
      throw new DraftStateValidationError('Player already has that team');
    }

    const nextPicker = getNextPicker(current.pickOrder, current.currentPicker);
    if (nextPicker === null) {
      throw new DraftStateValidationError(
        'Draft current picker is not in pick order'
      );
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const nextPlayerTeams = [...existingTeams, normalizedTeam];
    const nextAvailableTeams = current.availableTeams.filter(
      (entry) => entry !== normalizedTeam
    );
    const pickNumber = Math.max(1, Number(current.currentPickNumber) || 1);
    const nextState = normalizeDraftState(
      {
        ...current,
        availableTeams: nextAvailableTeams,
        currentPicker: nextPicker,
        currentPickNumber: pickNumber + 1,
        pickHistory: [
          ...(current.pickHistory || []),
          {
            playerId: normalizedPlayerId,
            team: normalizedTeam,
            pickNumber,
            pickedAt: nowIso,
          },
        ],
        updatedAt: nowIso,
        version: current.version + 1,
      },
      {
        nowIso,
      }
    );
    nextState.autoPickDeadlineAt = getNextAutoPickDeadline(nextState, now);

    try {
      await dynamoDB
        .transactWrite({
          TransactItems: [
            {
              Update: {
                TableName: playersTable,
                Key: { id: normalizedPlayerId },
                UpdateExpression: 'SET teams = :teams, updatedAt = :ts',
                ConditionExpression:
                  'attribute_exists(id) AND (attribute_not_exists(teams) OR NOT contains(teams, :team))',
                ExpressionAttributeValues: {
                  ':teams': nextPlayerTeams,
                  ':ts': nowIso,
                  ':team': normalizedTeam,
                },
              },
            },
            {
              Update: buildDraftStateVersionedWrite(nextState, expectedVersion),
            },
          ],
        })
        .promise();
    } catch (err) {
      if (
        err?.code === 'ConditionalCheckFailedException' ||
        err?.code === 'TransactionCanceledException'
      ) {
        const latest = await ensureDraftState();
        throw new DraftStateConflictError(
          'Draft state changed before the pick could be applied',
          latest
        );
      }
      throw err;
    }

    return {
      team: normalizedTeam,
      player: mapPlayerWithTeams(player, nextPlayerTeams, nowIso),
      state: nextState,
    };
  }

  async function undoLastDraftPick({ version, playersTable }) {
    const expectedVersion = parseDraftStateVersion(version);
    if (expectedVersion === null) {
      throw new DraftStateValidationError(
        'version must be a non-negative integer'
      );
    }

    const current = await ensureDraftState();
    if (expectedVersion !== current.version) {
      throw new DraftStateConflictError(
        'Draft state version conflict',
        current
      );
    }

    const history = normalizePickHistory(current.pickHistory);
    if (history.length === 0) {
      throw new DraftStateValidationError('No picks are available to undo');
    }

    const lastPick = history[history.length - 1];
    const undoPlayerId = coerceId(lastPick.playerId);
    const undoTeam = normalizeDraftTeam(lastPick.team);
    if (!undoTeam) {
      throw new DraftStateValidationError(
        'Last pick is invalid and cannot be undone'
      );
    }

    const player = await getPlayerById(undoPlayerId, playersTable);
    if (!player) {
      throw new DraftStateValidationError(
        `Player ${undoPlayerId} was not found`
      );
    }

    const existingTeams = Array.isArray(player.teams) ? [...player.teams] : [];
    if (!existingTeams.includes(undoTeam)) {
      throw new DraftStateValidationError(
        'Last picked team is not assigned to the expected player'
      );
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const nextPlayerTeams = existingTeams.filter((entry) => entry !== undoTeam);
    const nextAvailableTeams = current.availableTeams.includes(undoTeam)
      ? [...current.availableTeams]
      : [...current.availableTeams, undoTeam];
    const fallbackPickNumber = Math.max(
      1,
      Number(current.currentPickNumber || 1) - 1
    );
    const restoredPickNumber =
      Number.isInteger(lastPick.pickNumber) && lastPick.pickNumber > 0
        ? lastPick.pickNumber
        : fallbackPickNumber;

    const nextState = normalizeDraftState(
      {
        ...current,
        availableTeams: nextAvailableTeams,
        currentPicker: undoPlayerId,
        currentPickNumber: restoredPickNumber,
        pickHistory: history.slice(0, -1),
        updatedAt: nowIso,
        version: current.version + 1,
      },
      {
        nowIso,
      }
    );
    nextState.autoPickDeadlineAt = getNextAutoPickDeadline(nextState, now);

    try {
      await dynamoDB
        .transactWrite({
          TransactItems: [
            {
              Update: {
                TableName: playersTable,
                Key: { id: undoPlayerId },
                UpdateExpression: 'SET teams = :teams, updatedAt = :ts',
                ConditionExpression:
                  'attribute_exists(id) AND contains(teams, :team)',
                ExpressionAttributeValues: {
                  ':teams': nextPlayerTeams,
                  ':ts': nowIso,
                  ':team': undoTeam,
                },
              },
            },
            {
              Update: buildDraftStateVersionedWrite(nextState, expectedVersion),
            },
          ],
        })
        .promise();
    } catch (err) {
      if (
        err?.code === 'ConditionalCheckFailedException' ||
        err?.code === 'TransactionCanceledException'
      ) {
        const latest = await ensureDraftState();
        throw new DraftStateConflictError(
          'Draft state changed before the undo could be applied',
          latest
        );
      }
      throw err;
    }

    return {
      undonePick: lastPick,
      player: mapPlayerWithTeams(player, nextPlayerTeams, nowIso),
      state: nextState,
    };
  }
  return {
    ensureDraftState,
    getDraftStateVersionCondition,
    buildDraftStateVersionedWrite,
    updateDraftState,
    makeDraftPick,
    undoLastDraftPick,
  };
}
