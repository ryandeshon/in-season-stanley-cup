import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { db, resetDb, createConditionalError, clone } = vi.hoisted(() => {
  const db = { tables: {} };
  const clone = (value) => JSON.parse(JSON.stringify(value));

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
  };
});

function keyFor(key = {}) {
  const normalized = Object.keys(key)
    .sort()
    .reduce((acc, currentKey) => {
      acc[currentKey] = key[currentKey];
      return acc;
    }, {});
  return JSON.stringify(normalized);
}

function getKeySchema(tableName, sample = {}) {
  if (tableName === 'DraftState') return ['draftId'];
  if (tableName === 'PlayerSeason') return ['seasonId', 'playerId'];
  if (tableName === 'PlayerLifetime') return ['playerId'];
  if (tableName === 'GameRecordsV2') return ['seasonId', 'gameId'];
  if (tableName === 'GameOptions') return ['id'];
  if ('seasonId' in sample && 'playerId' in sample)
    return ['seasonId', 'playerId'];
  if ('seasonId' in sample && 'gameId' in sample) return ['seasonId', 'gameId'];
  if ('draftId' in sample) return ['draftId'];
  if ('playerId' in sample) return ['playerId'];
  return ['id'];
}

function getTable(tableName) {
  if (!db.tables[tableName]) {
    db.tables[tableName] = {};
  }
  return db.tables[tableName];
}

function putItem(tableName, item) {
  const keySchema = getKeySchema(tableName, item);
  const key = keySchema.reduce((acc, field) => {
    acc[field] = item[field];
    return acc;
  }, {});
  getTable(tableName)[keyFor(key)] = clone(item);
}

function getItem(tableName, key) {
  const keySchema = getKeySchema(tableName, key);
  const normalizedKey = keySchema.reduce((acc, field) => {
    acc[field] = key[field];
    return acc;
  }, {});
  return getTable(tableName)[keyFor(normalizedKey)] || null;
}

global.__awsDocumentClientMock = {
  get(params) {
    return {
      promise: async () => {
        const item = getItem(params.TableName, params.Key);
        return {
          Item: item ? clone(item) : undefined,
        };
      },
    };
  },
  put(params) {
    return {
      promise: async () => {
        const existing = getItem(params.TableName, params.Item);
        const condition = params.ConditionExpression || '';

        if (condition.includes('attribute_not_exists') && existing) {
          throw createConditionalError();
        }

        if (condition.includes('attribute_exists(draftId)')) {
          if (!existing) {
            throw createConditionalError();
          }
          const expectedVersion =
            params.ExpressionAttributeValues?.[':expectedVersion'];
          if (Number(existing.version) !== Number(expectedVersion)) {
            throw createConditionalError();
          }
        }

        putItem(params.TableName, params.Item);
        return {};
      },
    };
  },
  update(params) {
    return {
      promise: async () => {
        const existing = getItem(params.TableName, params.Key);
        const keySchema = getKeySchema(params.TableName, params.Key);
        const seeded = keySchema.reduce((acc, field) => {
          acc[field] = params.Key[field];
          return acc;
        }, {});
        const current = existing ? clone(existing) : seeded;
        const values = params.ExpressionAttributeValues || {};

        if (params.UpdateExpression?.includes('REMOVE gameID')) {
          delete current.gameID;
        }

        if (params.UpdateExpression?.includes('SET gameID = :gameID')) {
          current.gameID = values[':gameID'];
          current.updatedAt = values[':updatedAt'];
        }

        if (params.UpdateExpression?.includes('SET teams = :teams')) {
          current.teams = clone(values[':teams']);
          current.updatedAt = values[':updatedAt'];
        }

        putItem(params.TableName, current);

        if (params.ReturnValues === 'UPDATED_NEW') {
          return {
            Attributes: {
              gameID: current.gameID,
            },
          };
        }

        return {};
      },
    };
  },
  scan(params) {
    return {
      promise: async () => {
        const items = Object.values(getTable(params.TableName)).map((item) =>
          clone(item)
        );
        return { Items: items };
      },
    };
  },
  query(params) {
    return {
      promise: async () => {
        const items = Object.values(getTable(params.TableName)).map((item) =>
          clone(item)
        );
        const seasonId = params.ExpressionAttributeValues?.[':seasonId'];
        if (seasonId === undefined) {
          return { Items: items };
        }

        return {
          Items: items.filter((item) => item.seasonId === seasonId),
        };
      },
    };
  },
};

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
    const mod = await import('../../lambdas/http-api/index.js');
    handler = mod.handler;
  });

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
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
    putItem('GameRecordsV2', {
      seasonId: 'season2',
      gameId: '1',
      id: '1',
      wTeam: 'BOS',
      wScore: 4,
      lTeam: 'TOR',
      lScore: 2,
      savedAt: '2026-01-01T00:00:00.000Z',
    });
    putItem('GameRecordsV2', {
      seasonId: 'season2',
      gameId: '2',
      id: '2',
      wTeam: 'DAL',
      wScore: 3,
      lTeam: 'COL',
      lScore: 1,
      savedAt: '2026-02-01T00:00:00.000Z',
    });
    putItem('GameRecordsV2', {
      seasonId: 'season2',
      gameId: '3',
      id: '3',
      wTeam: 'VAN',
      wScore: 5,
      lTeam: 'SEA',
      lScore: 4,
      savedAt: '2026-03-01T00:00:00.000Z',
    });

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
    putItem('DraftState', {
      draftId: 'season2',
      draftStarted: true,
      pickOrder: ['1', '2'],
      currentPicker: '1',
      currentPickNumber: 1,
      availableTeams: ['BOS', 'TOR'],
      version: 2,
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

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
    putItem('DraftState', {
      draftId: 'season2',
      draftStarted: true,
      pickOrder: ['1', '2'],
      currentPicker: '1',
      currentPickNumber: 1,
      availableTeams: ['BOS', 'TOR'],
      version: 0,
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

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
    expect(authorized.json.currentPicker).toBe('2');
  });

  it('returns 409 with current state for stale draft updates', async () => {
    putItem('DraftState', {
      draftId: 'season2',
      draftStarted: true,
      pickOrder: ['1', '2'],
      currentPicker: '1',
      currentPickNumber: 1,
      availableTeams: ['BOS', 'TOR'],
      version: 4,
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const result = await invoke('/draft/state', 'PATCH', {
      body: {
        version: 3,
        currentPicker: 2,
      },
    });

    expect(result.statusCode).toBe(409);
    expect(result.json.currentVersion).toBe(4);
    expect(result.json.currentState.currentPicker).toBe('1');
  });

  it('accepts in-order draft updates and increments version', async () => {
    putItem('DraftState', {
      draftId: 'season2',
      draftStarted: true,
      pickOrder: ['1', '2'],
      currentPicker: '1',
      currentPickNumber: 1,
      availableTeams: ['BOS', 'TOR'],
      version: 1,
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const result = await invoke('/draft/state', 'PATCH', {
      body: {
        version: 1,
        currentPicker: 2,
        currentPickNumber: 2,
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json.currentPicker).toBe('2');
    expect(result.json.version).toBe(2);
  });
});
