import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import axios from 'axios';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SOCKET_DOMAIN = process.env.SOCKET_DOMAIN;
const SOCKET_STAGE = process.env.SOCKET_STAGE || 'prod';
const GAME_OPTIONS_TABLE = process.env.GAME_OPTIONS_TABLE || 'GameOptions';
const SOCKET_CONNECTIONS_TABLE =
  process.env.SOCKET_CONNECTIONS_TABLE || 'SocketConnections';
const GAME_OPTIONS_KEY = process.env.GAME_OPTIONS_KEY || 'currentChampion';

const dbClient = new DynamoDBClient({ region: REGION });
const db = DynamoDBDocumentClient.from(dbClient);

function getSocketClient() {
  if (!SOCKET_DOMAIN) {
    throw new Error('SOCKET_DOMAIN is required');
  }

  return new ApiGatewayManagementApiClient({
    region: REGION,
    endpoint: `https://${SOCKET_DOMAIN}/${SOCKET_STAGE}`,
  });
}

export const handler = async () => {
  try {
    const socketClient = getSocketClient();

    // 1. Get the current gameId
    const gameId = await getCurrentGameId();
    if (!gameId) {
      console.warn('No game ID found in GameOptions');
      return { statusCode: 200, body: 'No game to update' };
    }

    // 2. Get game data
    const response = await axios.get(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
    );
    const gameData = response.data;

    // 3. Get all connections
    const connections = await getAllConnections();

    const message = {
      type: 'liveGameUpdate',
      payload: gameData,
    };

    // 4. Broadcast to each client
    const results = await Promise.allSettled(
      connections.map(({ connectionId }) =>
        socketClient
          .send(
            new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: Buffer.from(JSON.stringify(message)),
            })
          )
          .catch((err) => {
            if (err.statusCode === 410) {
              console.log(
                `🧹 Stale connection ${connectionId}, should be removed`
              );
              // Optionally delete from table here
            } else {
              console.error('❌ Failed to post to connection:', err);
            }
          })
      )
    );

    console.log(`✅ Message sent to ${results.length} connections`);
    return { statusCode: 200, body: 'Broadcast sent' };
  } catch (err) {
    console.error('❌ Lambda Error:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

// Helper to get current gameId from GameOptions
export async function getCurrentGameId() {
  const response = await db.send(
    new GetCommand({
      TableName: GAME_OPTIONS_TABLE,
      Key: { id: GAME_OPTIONS_KEY },
    })
  );

  if (!response.Item || !response.Item.gameID) {
    throw new Error('gameID not found in GameOptions');
  }

  return response.Item.gameID;
}

// Helper to scan all active WebSocket connections
async function getAllConnections() {
  const result = await db.send(
    new ScanCommand({ TableName: SOCKET_CONNECTIONS_TABLE })
  );
  return result.Items || [];
}
