import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { db, resetDb, createConditionalError, clone, cloudFrontInvalidations } =
  vi.hoisted(() => {
    const db = { tables: {} };
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const cloudFrontInvalidations = [];

    function resetDb() {
      db.tables = {};
    }

    function createConditionalError() {
      const error = new Error('ConditionalCheckFailedException');
      error.code = 'ConditionalCheckFailedException';
      return error;
    }

    return {
      db,
      resetDb,
      createConditionalError,
      clone,
      cloudFrontInvalidations,
    };
  });

function getTable(tableName) {
  if (!db.tables[tableName]) {
    db.tables[tableName] = {};
  }
  return db.tables[tableName];
}

global.__awsDocumentClientMock = {
  get(params) {
    return {
      promise: async () => {
        const table = getTable(params.TableName);
        return {
          Item: table[params.Key.id] ? clone(table[params.Key.id]) : undefined,
        };
      },
    };
  },
  put(params) {
    return {
      promise: async () => {
        const table = getTable(params.TableName);
        if (
          params.ConditionExpression === 'attribute_not_exists(id)' &&
          table[params.Item.id]
        ) {
          throw createConditionalError();
        }
        table[params.Item.id] = clone(params.Item);
        return {};
      },
    };
  },
  update(params) {
    return {
      promise: async () => applyUpdateOperation(params),
    };
  },
  transactWrite(params) {
    return {
      promise: async () => {
        const snapshot = clone(db.tables);
        try {
          for (const item of params.TransactItems || []) {
            if (!item?.Update) {
              throw new Error('Unsupported transact item in test mock');
            }
            applyUpdateOperation(item.Update);
          }
          return {};
        } catch (error) {
          db.tables = snapshot;
          throw error;
        }
      },
    };
  },
  scan(params) {
    return {
      promise: async () => {
        const table = getTable(params.TableName);
        return { Items: Object.values(table).map((item) => clone(item)) };
      },
    };
  },
  query() {
    return {
      promise: async () => ({ Items: [] }),
    };
  },
};

global.__awsCloudFrontMock = {
  createInvalidation(params) {
    return {
      promise: async () => {
        cloudFrontInvalidations.push(clone(params));
        return {
          Invalidation: {
            Id: 'test-invalidation-id',
            Status: 'InProgress',
          },
        };
      },
    };
  },
};

function applyUpdateOperation(params) {
  const table = getTable(params.TableName);
  const keyId = params.Key.id;
  const itemExists = Object.prototype.hasOwnProperty.call(table, keyId);
  const current = itemExists ? clone(table[keyId]) : { id: keyId };
  const names = params.ExpressionAttributeNames || {};
  const values = params.ExpressionAttributeValues || {};
  const condition = params.ConditionExpression || '';

  if (condition.includes('attribute_exists(id)') && !itemExists) {
    throw createConditionalError();
  }

  if (condition.includes('#state.#version')) {
    const currentVersion = current?.state?.version;
    const expected = values[':expected'];
    const zero = values[':zero'];
    const conditionMet =
      (currentVersion === undefined && expected === zero) ||
      currentVersion === expected;
    if (!conditionMet) {
      throw createConditionalError();
    }
  }

  if (condition.includes('NOT contains(teams, :team)')) {
    const team = values[':team'];
    const teamExists =
      Array.isArray(current.teams) && current.teams.includes(team);
    if (teamExists) {
      throw createConditionalError();
    }
  }

  if (
    condition.includes('contains(teams, :team)') &&
    !condition.includes('NOT contains(teams, :team)')
  ) {
    const team = values[':team'];
    const teamExists =
      Array.isArray(current.teams) && current.teams.includes(team);
    if (!teamExists) {
      throw createConditionalError();
    }
  }

  if (params.UpdateExpression?.includes('REMOVE gameID')) {
    delete current.gameID;
  }

  if (params.UpdateExpression?.includes('#state = :state')) {
    current[names['#state']] = clone(values[':state']);
  }
  if (params.UpdateExpression?.includes('#updatedAt = :ts')) {
    current[names['#updatedAt']] = values[':ts'];
  }
  if (params.UpdateExpression?.includes('SET gameID = :g')) {
    current.gameID = values[':g'];
    current.updatedAt = values[':ts'];
  }
  if (params.UpdateExpression?.includes('SET teams = :teams')) {
    current.teams = clone(values[':teams']);
    current.updatedAt = values[':ts'];
  }

  table[keyId] = current;

  if (params.ReturnValues === 'UPDATED_NEW') {
    return { Attributes: { gameID: current.gameID } };
  }
  if (params.ReturnValues === 'ALL_NEW') {
    return { Attributes: clone(current) };
  }

  return {};
}

let handler;

function createEvent(path, method = 'GET', options = {}) {
  return {
    rawPath: path,
    requestContext: {
      http: {
        method,
      },
    },
    headers: options.headers || {},
    body: options.body ? JSON.stringify(options.body) : undefined,
    queryStringParameters: options.queryStringParameters || null,
  };
}

async function invoke(path, method = 'GET', options = {}) {
  const result = await handler(createEvent(path, method, options));
  return {
    ...result,
    json: JSON.parse(result.body || '{}'),
  };
}

describe('http-api contract behavior', () => {
  beforeAll(async () => {
    process.env.API_CACHE_DISTRIBUTION_ID = 'DIST_TEST';
    process.env.API_CACHE_INVALIDATION_PATHS = '/champion,/gameid,/season/meta';
    const mod = await import('../../lambdas/http-api/index.js');
    handler = mod.handler;
  });

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    cloudFrontInvalidations.length = 0;
    delete process.env.ADMIN_API_TOKEN;
  });

  it('returns 400 for invalid season query values', async () => {
    const result = await invoke('/season/meta', 'GET', {
      queryStringParameters: { season: 'winter' },
    });

    expect(result.statusCode).toBe(400);
    expect(result.json.error).toContain('Invalid season query parameter');
  });

  it('returns champion history sorted and respects limit', async () => {
    const table = getTable('GameRecords');
    table[1] = {
      id: 1,
      wTeam: 'BOS',
      wScore: 4,
      lTeam: 'TOR',
      lScore: 2,
      savedAt: '2026-01-01T00:00:00.000Z',
    };
    table[2] = {
      id: 2,
      wTeam: 'DAL',
      wScore: 3,
      lTeam: 'COL',
      lScore: 1,
      savedAt: '2026-02-01T00:00:00.000Z',
    };
    table[3] = {
      id: 3,
      wTeam: 'VAN',
      wScore: 5,
      lTeam: 'SEA',
      lScore: 4,
      savedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = await invoke('/champion/history', 'GET', {
      queryStringParameters: { limit: '2' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json.history).toHaveLength(2);
    expect(result.json.history[0].gameId).toBe(3);
    expect(result.json.history[1].gameId).toBe(2);
    expect(result.json.history[0].participants).toEqual(['VAN', 'SEA']);
  });

  it('returns 400 for invalid champion history limits', async () => {
    const result = await invoke('/champion/history', 'GET', {
      queryStringParameters: { limit: '0' },
    });

    expect(result.statusCode).toBe(400);
    expect(result.json.error).toContain('limit must be a positive integer');
  });

  it('rejects draft patch when version is missing', async () => {
    const table = getTable('GameOptions');
    table.draftState = {
      id: 'draftState',
      state: {
        draftStarted: true,
        pickOrder: [1, 2],
        currentPicker: 1,
        currentPickNumber: 1,
        availableTeams: ['BOS', 'TOR'],
        version: 2,
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = await invoke('/draft/state', 'PATCH', {
      body: {
        currentPicker: 2,
      },
    });

    expect(result.statusCode).toBe(400);
    expect(result.json.error).toContain('version is required');
  });

  it('enforces auth on protected routes when admin token is configured', async () => {
    process.env.ADMIN_API_TOKEN = 'super-secret';
    const table = getTable('GameOptions');
    table.draftState = {
      id: 'draftState',
      state: {
        draftStarted: true,
        pickOrder: [1, 2],
        currentPicker: 1,
        currentPickNumber: 1,
        availableTeams: ['BOS', 'TOR'],
        version: 0,
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const unauthorized = await invoke('/draft/state', 'PATCH', {
      body: {
        version: 0,
        currentPicker: 2,
      },
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json.error).toBe('Unauthorized');

    const authorized = await invoke('/draft/state', 'PATCH', {
      headers: {
        'x-admin-token': 'super-secret',
      },
      body: {
        version: 0,
        currentPicker: 2,
      },
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json.currentPicker).toBe(2);
  });

  it('returns 409 with current state for stale draft updates', async () => {
    const table = getTable('GameOptions');
    table.draftState = {
      id: 'draftState',
      state: {
        draftStarted: true,
        pickOrder: [1, 2],
        currentPicker: 1,
        currentPickNumber: 1,
        availableTeams: ['BOS', 'TOR'],
        version: 4,
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = await invoke('/draft/state', 'PATCH', {
      body: {
        version: 3,
        currentPicker: 2,
      },
    });

    expect(result.statusCode).toBe(409);
    expect(result.json.currentVersion).toBe(4);
    expect(result.json.currentState.currentPicker).toBe(1);
  });

  it('applies /draft/pick with server-side validation and history tracking', async () => {
    const optionsTable = getTable('GameOptions');
    const playersTable = getTable('Players');
    playersTable[1] = { id: 1, name: 'Ryan', teams: [] };
    playersTable[2] = { id: 2, name: 'Boz', teams: [] };

    optionsTable.draftState = {
      id: 'draftState',
      state: {
        draftStarted: true,
        pickOrder: [1, 2],
        currentPicker: 1,
        currentPickNumber: 1,
        availableTeams: ['BOS', 'TOR'],
        version: 2,
        isLocked: false,
        pickHistory: [],
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = await invoke('/draft/pick', 'POST', {
      body: {
        playerId: 1,
        team: 'BOS',
        version: 2,
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json.team).toBe('BOS');
    expect(result.json.state.currentPicker).toBe(2);
    expect(result.json.state.currentPickNumber).toBe(2);
    expect(result.json.state.availableTeams).toEqual(['TOR']);
    expect(result.json.state.version).toBe(3);
    expect(result.json.state.pickHistory).toHaveLength(1);
    expect(result.json.state.pickHistory[0].playerId).toBe(1);
    expect(result.json.state.pickHistory[0].team).toBe('BOS');
    expect(getTable('Players')[1].teams).toEqual(['BOS']);
  });

  it('rejects /draft/pick while draft is locked', async () => {
    const optionsTable = getTable('GameOptions');
    const playersTable = getTable('Players');
    playersTable[1] = { id: 1, name: 'Ryan', teams: [] };

    optionsTable.draftState = {
      id: 'draftState',
      state: {
        draftStarted: true,
        pickOrder: [1, 2],
        currentPicker: 1,
        currentPickNumber: 1,
        availableTeams: ['BOS', 'TOR'],
        version: 4,
        isLocked: true,
        pickHistory: [],
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = await invoke('/draft/pick', 'POST', {
      body: {
        playerId: 1,
        team: 'BOS',
        version: 4,
      },
    });

    expect(result.statusCode).toBe(400);
    expect(result.json.error).toContain('locked');
  });

  it('undoes the last pick and restores player/draft state', async () => {
    const optionsTable = getTable('GameOptions');
    const playersTable = getTable('Players');
    playersTable[1] = { id: 1, name: 'Ryan', teams: ['BOS'] };
    playersTable[2] = { id: 2, name: 'Boz', teams: [] };

    optionsTable.draftState = {
      id: 'draftState',
      state: {
        draftStarted: true,
        pickOrder: [1, 2],
        currentPicker: 2,
        currentPickNumber: 2,
        availableTeams: ['TOR'],
        version: 5,
        isLocked: false,
        pickHistory: [
          {
            playerId: 1,
            team: 'BOS',
            pickNumber: 1,
            pickedAt: '2026-03-01T01:00:00.000Z',
          },
        ],
      },
      updatedAt: '2026-03-01T01:00:00.000Z',
    };

    const result = await invoke('/draft/undo-last-pick', 'POST', {
      body: {
        version: 5,
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json.state.currentPicker).toBe(1);
    expect(result.json.state.currentPickNumber).toBe(1);
    expect(result.json.state.version).toBe(6);
    expect(result.json.state.pickHistory).toHaveLength(0);
    expect(result.json.state.availableTeams).toEqual(
      expect.arrayContaining(['TOR', 'BOS'])
    );
    expect(getTable('Players')[1].teams).toEqual([]);
  });

  it('accepts in-order draft updates and increments version', async () => {
    const table = getTable('GameOptions');
    table.draftState = {
      id: 'draftState',
      state: {
        draftStarted: true,
        pickOrder: [1, 2],
        currentPicker: 1,
        currentPickNumber: 1,
        availableTeams: ['BOS', 'TOR'],
        version: 1,
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = await invoke('/draft/state', 'PATCH', {
      body: {
        version: 1,
        currentPicker: 2,
        currentPickNumber: 2,
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json.currentPicker).toBe(2);
    expect(result.json.version).toBe(2);
  });

  it('invalidates API cache when draft transitions to started', async () => {
    const table = getTable('GameOptions');
    table.draftState = {
      id: 'draftState',
      state: {
        draftStarted: false,
        pickOrder: [1, 2],
        currentPicker: 1,
        currentPickNumber: 1,
        availableTeams: ['BOS', 'TOR'],
        version: 0,
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = await invoke('/draft/state', 'PATCH', {
      body: {
        version: 0,
        draftStarted: true,
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json.draftStarted).toBe(true);
    expect(cloudFrontInvalidations).toHaveLength(1);
    expect(cloudFrontInvalidations[0].DistributionId).toBe('DIST_TEST');
    expect(cloudFrontInvalidations[0].InvalidationBatch.Paths.Items).toEqual(
      expect.arrayContaining(['/champion', '/gameid', '/season/meta'])
    );
  });
});
