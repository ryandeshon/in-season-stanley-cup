import storage from '../shared/season-storage.cjs';
export function createRepository({
  GAME_OPTIONS_TABLE,
  GAME_RECORDS_TABLE,
  PLAYERS_TABLE,
  dynamoDB,
  GAME_OPTIONS_KEY = 'currentChampion',
}) {
  async function listPlayers(tableName = PLAYERS_TABLE) {
    return storage.collect(dynamoDB, 'scan', {
      TableName: tableName,
      ConsistentRead: true,
    });
  }

  async function getPlayerByName(name, tableName = PLAYERS_TABLE) {
    const players = await listPlayers(tableName);
    return players.find((player) => player.name === name) || null;
  }

  async function getPlayerById(id, tableName = PLAYERS_TABLE) {
    const res = await dynamoDB
      .get({ TableName: tableName, Key: { id }, ConsistentRead: true })
      .promise();
    return res.Item || null;
  }

  async function updatePlayerTeams(
    id,
    team,
    action = 'add',
    tableName = PLAYERS_TABLE
  ) {
    const player = await getPlayerById(id, tableName);
    if (!player) throw new Error(`Player ${id} not found`);

    const currentTeams = Array.isArray(player.teams) ? [...player.teams] : [];
    const nextTeams =
      action === 'remove'
        ? currentTeams.filter((t) => t !== team)
        : currentTeams.includes(team)
          ? currentTeams
          : [...currentTeams, team];

    const res = await dynamoDB
      .update({
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET teams = :teams, updatedAt = :ts',
        ExpressionAttributeValues: {
          ':teams': nextTeams,
          ':ts': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
      .promise();

    return res.Attributes;
  }

  async function resetTeams(tableName = PLAYERS_TABLE) {
    const allPlayers = await listPlayers(tableName);
    const promises = allPlayers.map((p) =>
      dynamoDB
        .update({
          TableName: tableName,
          Key: { id: p.id },
          UpdateExpression: 'REMOVE teams',
        })
        .promise()
    );
    await Promise.all(promises);
  }

  async function listGameRecords(tableName = GAME_RECORDS_TABLE) {
    return storage.collect(dynamoDB, 'scan', {
      TableName: tableName,
      ConsistentRead: true,
    });
  }

  async function getGameOptions() {
    const res = await dynamoDB
      .get({ TableName: GAME_OPTIONS_TABLE, Key: { id: GAME_OPTIONS_KEY } })
      .promise();
    return res.Item || {};
  }

  async function setGameId(gameID) {
    if (!gameID) {
      await dynamoDB
        .update({
          TableName: GAME_OPTIONS_TABLE,
          Key: { id: GAME_OPTIONS_KEY },
          UpdateExpression: 'REMOVE gameID',
        })
        .promise();
      return null;
    }

    const res = await dynamoDB
      .update({
        TableName: GAME_OPTIONS_TABLE,
        Key: { id: GAME_OPTIONS_KEY },
        UpdateExpression: 'SET gameID = :g, updatedAt = :ts',
        ExpressionAttributeValues: {
          ':g': gameID,
          ':ts': new Date().toISOString(),
        },
        ReturnValues: 'UPDATED_NEW',
      })
      .promise();
    return res.Attributes?.gameID || gameID;
  }

  function parseHistoryLimit(limitRaw) {
    if (limitRaw === undefined || limitRaw === null || limitRaw === '') {
      return 25;
    }
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return Math.min(parsed, 200);
  }

  function mapChampionHistoryRecord(record = {}) {
    const winnerTeam = record.wTeam ?? null;
    const loserTeam = record.lTeam ?? null;
    const participants = [winnerTeam, loserTeam].filter(Boolean);
    const recordedAt =
      record.savedAt ||
      record.finalizedAt ||
      record.updatedAt ||
      record.createdAt ||
      null;
    const idNumber = Number(record.id);
    return {
      gameId: Number.isFinite(idNumber) ? idNumber : (record.id ?? null),
      winnerTeam,
      winnerScore: Number.isFinite(Number(record.wScore))
        ? Number(record.wScore)
        : null,
      loserTeam,
      loserScore: Number.isFinite(Number(record.lScore))
        ? Number(record.lScore)
        : null,
      participants,
      recordedAt,
    };
  }

  function historySortKey(entry = {}) {
    const timestamp = Date.parse(entry.recordedAt || '');
    if (Number.isFinite(timestamp)) return timestamp;
    const gameIdNumber = Number(entry.gameId);
    if (Number.isFinite(gameIdNumber)) return gameIdNumber;
    return -1;
  }

  async function listChampionHistory(limit, tableName = GAME_RECORDS_TABLE) {
    const records = await listGameRecords(tableName);
    return records
      .map(mapChampionHistoryRecord)
      .sort((a, b) => historySortKey(b) - historySortKey(a))
      .slice(0, limit);
  }
  return {
    listPlayers,
    getPlayerByName,
    getPlayerById,
    updatePlayerTeams,
    resetTeams,
    listGameRecords,
    getGameOptions,
    setGameId,
    parseHistoryLimit,
    mapChampionHistoryRecord,
    historySortKey,
    listChampionHistory,
  };
}
