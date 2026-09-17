const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const { DeleteTableCommand } = require('@aws-sdk/client-dynamodb');
const {
  connect,
  createTables,
  snapshot,
} = require('../../scripts/season/rollover.cjs');
const {
  planMigration,
  applyMigration,
  definitions,
  hash,
} = require('../../scripts/season/migration.cjs');
const { transition } = require('../../lambdas/shared/season-lifecycle.cjs');
const { scopedClient } = require('../../lambdas/shared/season-storage.cjs');
const {
  createFinalization,
} = require('../../lambdas/check-game/finalization.cjs');
const {
  createStateStore,
} = require('../../lambdas/check-game/state-store.cjs');
const { createConfig } = require('../../lambdas/check-game/config.cjs');
const { createChecker } = require('../../lambdas/check-game/handler.cjs');
const fixture = require('../fixtures/season-source.cjs');
test(
  'migration, restore and next-season lifecycle preserve history on disposable DynamoDB',
  { timeout: 300000 },
  async () => {
    const source = process.env.SEASON_REHEARSAL_SOURCE
      ? JSON.parse(fs.readFileSync(process.env.SEASON_REHEARSAL_SOURCE, 'utf8'))
      : fixture();
    const plan = planMigration(source, { acceptStoredTotals: true });
    const prefix = `isc-phase3-${randomUUID().slice(0, 8)}-`;
    const tables = Object.fromEntries(
      Object.keys(definitions).map((k) => [k, prefix + k])
    );
    const restored = Object.fromEntries(
      Object.keys(definitions).map((k) => [k, prefix + 'restore-' + k])
    );
    const { db: raw, client } = connect({
      aws: process.env.DYNAMODB_TEST_AWS === 'true',
      endpoint: process.env.DYNAMODB_TEST_ENDPOINT,
    });
    // Guard every operation, and force pagination to exercise all readers.
    const db = Object.fromEntries(
      Object.entries(raw).map(([op, fn]) => [
        op,
        (p) => {
          const targets = p.TransactItems?.map(
            (i) => Object.values(i)[0].TableName
          ) || [p.TableName];
          assert.ok(targets.every((t) => t.startsWith(prefix)));
          return fn(
            ['scan', 'query'].includes(op)
              ? { ...p, Limit: process.env.SEASON_REHEARSAL_SOURCE ? 25 : 2 }
              : p
          );
        },
      ])
    );
    try {
      await createTables(client, tables);
      await createTables(client, restored);
      const dry = await applyMigration(db, tables, plan);
      assert.equal(dry.applied, false);
      assert.equal((await snapshot(db, tables)).rows.players.length, 0);
      assert.ok(
        (await applyMigration(db, tables, plan, { apply: true })).pending > 0
      );
      assert.equal(
        (await applyMigration(db, tables, plan, { apply: true })).pending,
        0
      );
      const backup = await snapshot(db, tables);
      await applyMigration(db, restored, backup, { apply: true });
      assert.equal(
        (await snapshot(db, restored)).targetHash,
        backup.targetHash
      );
      const archived = (rows) =>
        hash({
          players: rows.players.filter((p) => p.seasonId !== 'season3'),
          records: rows.records.filter((p) => p.seasonId !== 'season3'),
          options: rows.options.filter((p) => p.seasonId !== 'season3'),
          catalog: rows.catalog.filter((p) => p.id !== 'season3'),
        });
      const beforeArchive = archived(backup.rows);
      assert.deepEqual(
        backup.rows.lifetime.map((p) => p.totalDefenses).sort(),
        source.Players.map((p) => p.totalDefenses).sort()
      );
      assert.ok(
        backup.rows.players
          .filter((p) => p.seasonId === 'season3')
          .every((p) => p.titleDefenses === 0 && !p.teams.length)
      );
      const env = {
        SEASON_STORAGE: 'v2',
        SEASON_PLAYERS_TABLE: tables.players,
        SEASON_RECORDS_TABLE: tables.records,
        SEASON_OPTIONS_TABLE: tables.options,
        PLAYER_LIFETIME_TABLE: tables.lifetime,
        SEASON_CATALOG_TABLE: tables.catalog,
        ADMIN_API_TOKEN: 'test-only',
        SELF_SCHEDULING_ENABLED: 'false',
      };
      const { createHttpHandler } =
        await import('../../lambdas/http-api/handler.js');
      const api = createHttpHandler({ dynamoDB: db, https: null, env });
      const req = async (
        path,
        method = 'GET',
        body,
        season = 'season3',
        authorized = true
      ) => {
        const r = await api({
          rawPath: path,
          requestContext: { http: { method } },
          queryStringParameters: { season },
          headers: authorized ? { 'x-admin-token': 'test-only' } : {},
          body: JSON.stringify(body),
        });
        return { ...r, json: JSON.parse(r.body) };
      };
      assert.equal((await req('/seasons')).json.defaultSeason, 'season3');
      assert.equal(
        (await req('/players', 'GET', undefined, 'season99')).statusCode,
        404
      );
      assert.equal(
        (await req('/champion', 'GET', undefined, 'season1')).json.champion,
        plan.rows.options.find(
          (o) => o.seasonId === 'season1' && o.id === 'currentChampion'
        ).champion
      );
      for (const season of ['season1', 'season2']) {
        assert.equal(
          (await req('/players', 'GET', undefined, season)).json.length,
          4
        );
        assert.equal(
          (
            await req(
              '/draft/pick',
              'POST',
              { playerId: 0, team: 'BOS', version: 0 },
              season
            )
          ).statusCode,
          423
        );
        await req('/draft/state', 'GET', undefined, season);
        await req('/champion', 'GET', undefined, season);
      }
      assert.equal(
        (await req('/draft/state', 'PATCH', { version: 0 })).statusCode,
        423
      );
      let enabled = await transition(db, tables, 'season3', 1, {
        status: 'preseason',
      });
      assert.equal(
        (await req('/draft/state', 'PATCH', { version: 0 }, 'season3', false))
          .statusCode,
        401
      );
      const initial = await req('/draft/state');
      let state = (
        await req('/draft/state', 'PATCH', {
          version: initial.json.version,
          draftStarted: true,
          pickOrder: [0, 1, 2, 3],
          currentPicker: 0,
        })
      ).json;
      assert.equal(state.currentPicker, 0);
      const team = state.availableTeams[0];
      const race = await Promise.all([
        req('/draft/pick', 'POST', {
          playerId: 0,
          team,
          version: state.version,
        }),
        req('/draft/pick', 'POST', {
          playerId: 0,
          team,
          version: state.version,
        }),
      ]);
      assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
      state = race.find((r) => r.statusCode === 200).json.state;
      const reset = await req('/players/reset-teams', 'POST', {
        version: state.version,
      });
      assert.equal(reset.statusCode, 200);
      assert.ok(
        (await req('/players')).json.every((p) => p.teams.length === 0)
      );
      assert.equal(
        (await req('/players/reset-teams', 'POST', { version: state.version }))
          .statusCode,
        409
      );
      state = (
        await req('/draft/state', 'PATCH', {
          version: reset.json.state.version,
          draftStarted: true,
          pickOrder: [0, 1, 2, 3],
          currentPicker: 0,
        })
      ).json;
      for (let i = 0; i < 32; i++) {
        const r = await req('/draft/pick', 'POST', {
          playerId: i % 4,
          team: state.availableTeams[0],
          version: state.version,
        });
        assert.equal(r.statusCode, 200, JSON.stringify(r.json));
        state = r.json.state;
      }
      const champion = (await req('/players')).json.find((p) => p.id === '0')
        .teams[0];
      const active = await transition(
        db,
        tables,
        'season3',
        enabled.season.revision,
        {
          status: 'active',
          champion,
          regularSeasonEnd: '2027-04-15',
          playoffsStart: '2027-04-17',
        }
      );
      assert.equal(
        (
          await req('/draft/pick', 'POST', {
            playerId: 0,
            team: 'BOS',
            version: state.version,
          })
        ).statusCode,
        423
      );
      await assert.rejects(
        scopedClient(db, tables, enabled.season, 'preseason')
          .update({
            TableName: tables.players,
            Key: { id: '0' },
            UpdateExpression: 'SET teams = :t',
            ExpressionAttributeValues: { ':t': [] },
          })
          .promise()
      );
      const checker = createChecker({
        dynamoDB: db,
        env,
        https: null,
        log: () => {},
      });
      assert.equal((await checker({ seasonId: 'season2' })).statusCode, 423);
      assert.equal((await checker({})).statusCode, 423);
      const scoped = scopedClient(db, tables, active.season, 'active');
      const context = {
        ...createConfig({
          ...env,
          PLAYERS_TABLE: tables.players,
          GAME_OPTIONS_TABLE: tables.options,
          GAME_RECORDS_TABLE: tables.records,
        }),
        env,
        dynamoDB: scoped,
        log: () => {},
      };
      Object.assign(context, createStateStore(context));
      const finalize = createFinalization(context).finalizeGame;
      const game = {
        gameID: 2026020001,
        expectedChampion: champion,
        wTeam: champion,
        wScore: 3,
        lTeam: 'BOS',
        lScore: 1,
      };
      const finals = await Promise.all([finalize(game), finalize(game)]);
      assert.equal(finals.filter((f) => f.applied).length, 1);
      // Exercise the public checker factory and its season/year routing too.
      const finalChecker = createChecker({
        dynamoDB: db,
        env,
        log: () => {},
        https: {
          get: (url, callback) => {
            const req = new EventEmitter();
            req.setTimeout = () => {};
            queueMicrotask(() => {
              const res = new EventEmitter();
              callback(res);
              const today = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/New_York',
              }).format(new Date());
              const payload = url.includes('/schedule/')
                ? {
                    gameWeek: [
                      {
                        date: today,
                        games: [
                          {
                            id: game.gameID,
                            homeTeam: { abbrev: champion },
                            awayTeam: { abbrev: 'BOS' },
                          },
                        ],
                      },
                    ],
                  }
                : {
                    gameType: 2,
                    gameState: 'FINAL',
                    homeTeam: { abbrev: champion, score: 3 },
                    awayTeam: { abbrev: 'BOS', score: 1 },
                  };
              res.emit('data', JSON.stringify(payload));
              res.emit('end');
            });
            return req;
          },
        },
      });
      assert.equal(
        (await finalChecker({ seasonId: 'season3' })).statusCode,
        200
      );
      await scoped
        .update({
          TableName: tables.options,
          Key: { id: 'currentChampion' },
          UpdateExpression: 'SET activeGameId = :id',
          ExpressionAttributeValues: { ':id': 2025020001 },
        })
        .promise();
      assert.equal(
        (await finalChecker({ seasonId: 'season3' })).statusCode,
        500
      );
      await scoped
        .update({
          TableName: tables.options,
          Key: { id: 'currentChampion' },
          UpdateExpression: 'REMOVE activeGameId',
        })
        .promise();
      const closed = await transition(
        db,
        tables,
        'season3',
        active.season.revision,
        { status: 'archived' }
      );
      assert.equal(closed.season.championPlayerId, '0');
      assert.equal(
        (
          await transition(db, tables, 'season3', active.season.revision, {
            status: 'archived',
          })
        ).applied,
        false
      );
      await assert.rejects(finalize({ ...game, gameID: 2026020002 }));
      const after = await snapshot(db, tables);
      assert.equal(archived(after.rows), beforeArchive);
      const lifetime = after.rows.lifetime.find((p) => p.id === '0');
      const baseline = source.Players.find((p) => p.id === '0');
      assert.equal(lifetime.totalDefenses, baseline.totalDefenses + 1);
      assert.equal(lifetime.championships, baseline.championships + 1);
      await assert.rejects(
        applyMigration(db, tables, plan, { apply: true }),
        /differs/
      );
      assert.equal(
        (await snapshot(db, restored)).targetHash,
        backup.targetHash
      );
      console.log(
        JSON.stringify({
          rehearsal: 'passed',
          sourceCounts: plan.sourceCounts,
          anomalies: plan.anomalies,
          backupHash: backup.targetHash,
          archiveUnchanged: true,
          restoredUnchanged: true,
        })
      );
    } finally {
      await Promise.all(
        [...Object.values(tables), ...Object.values(restored)].map(
          async (TableName) => {
            try {
              await client.send(new DeleteTableCommand({ TableName }));
            } catch (e) {
              if (e.name !== 'ResourceNotFoundException') throw e;
            }
          }
        )
      );
      client.destroy();
    }
  }
);
