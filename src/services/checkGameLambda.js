import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'GameOptions';
const PLAYERS_TABLE = 'Players';
const GAME_RECORDS = 'GameRecords';
const PARTITION_KEY = 'currentChampion';
const API_URL = process.env.API_URL; // Your API Gateway URL that proxies to the NHL API

// Retrieve the stored gameID from DynamoDB
async function getGameID() {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
  };

  try {
    const result = await dynamoDB.get(params).promise();
    return result.Item ? result.Item.gameID : null;
  } catch (error) {
    console.error('Error retrieving game ID:', error);
    throw new Error('Failed to retrieve game ID');
  }
}

// Query the NHL API to check the game status and get the result
async function checkGameResult(gameID) {
  const apiUrl = `${API_URL}/gamecenter/${gameID}/boxscore`; // Adjust to match the endpoint for game details

  return new Promise((resolve, reject) => {
    https
      .get(apiUrl, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          const gameData = JSON.parse(data);
          const homeTeam = gameData.homeTeam;
          const awayTeam = gameData.awayTeam;

          // Check if the game is completed
          if (gameData.gameState === 'OFF') {
            // Determine the winner and loser
            const wTeam =
              homeTeam.score > awayTeam.score
                ? homeTeam.abbrev
                : awayTeam.abbrev;
            const lTeam =
              homeTeam.score > awayTeam.score
                ? awayTeam.abbrev
                : homeTeam.abbrev;
            const wScore =
              homeTeam.score > awayTeam.score ? homeTeam.score : awayTeam.score;
            const lScore =
              homeTeam.score > awayTeam.score ? awayTeam.score : homeTeam.score;
            resolve({ wTeam, wScore, lTeam, lScore });
          } else {
            console.log(
              `Game ${gameID}: ${homeTeam.abbrev} vs. ${awayTeam.abbrev} has not finished yet. (Status: ${gameData.gameState})`
            );
            resolve(null); // Game hasn't finished
          }
        });
      })
      .on('error', (e) => {
        console.error('API Request Error:', e);
        reject(e);
      });
  });
}

// Save the winner to the DynamoDB table
async function saveWinnerToDatabase(winner) {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: 'set champion = :winner',
    ExpressionAttributeValues: { ':winner': winner },
  };
  await dynamoDB.update(params).promise();
}

// Function to find which player has the winning team
async function findPlayerWithTeam(team) {
  const params = {
    TableName: PLAYERS_TABLE,
  };

  try {
    const result = await dynamoDB.scan(params).promise();
    const player = result.Items.find((player) => player.teams.includes(team));
    return player ? player.id : null;
  } catch (error) {
    console.error('Error scanning Players table:', error);
    throw new Error('Failed to find player with winning team');
  }
}

// Function to increment the titleDefenses and totalDefenses fields for the winning player
async function incrementTitleDefense(playerId) {
  const params = {
    TableName: PLAYERS_TABLE,
    Key: { id: playerId },
    UpdateExpression:
      'SET titleDefenses = titleDefenses + :inc, totalDefenses = if_not_exists(totalDefenses, :zero) + :inc',
    ExpressionAttributeValues: { ':inc': 1, ':zero': 0 },
  };

  await dynamoDB.update(params).promise();
}

// Function to save the game stats into GameRecords table
async function saveGameStats(gameID, wTeam, wScore, lTeam, lScore) {
  console.log(
    '🚀 ~ saveGameStats ~ gameID, wTeam, wScore, lTeam, lScore:',
    gameID,
    wTeam,
    wScore,
    lTeam,
    lScore
  );
  const params = {
    TableName: GAME_RECORDS,
    Item: {
      id: gameID,
      wTeam: wTeam,
      wScore: wScore,
      lTeam: lTeam,
      lScore: lScore,
    },
  };

  await dynamoDB.put(params).promise();
}

// function to check if game results are already in the database
async function checkGameResults(gameID) {
  const params = {
    TableName: GAME_RECORDS,
    Key: { id: gameID },
  };

  try {
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error retrieving game record:', error);
    throw new Error('Failed to retrieve game record');
  }
}

// Main handler
export const handler = async (event) => {
  try {
    const gameID = await getGameID();
    // If there is no game stop checking
    if (!gameID) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No game to check' }),
      };
    }

    // Check the game result
    const result = await checkGameResult(gameID);

    if (result.gameType !== 2) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Not a regular season game' }),
      };
    }

    if (result) {
      // Save the winner to DynamoDB
      const { wTeam, wScore, lTeam, lScore } = result;
      console.log('🚀 ~ handler ~ result:', result);
      // Save the game stats
      const gameAlreadySaved = await checkGameResults(gameID);
      if (gameAlreadySaved) {
        console.log('Game is already saved');
        return;
      }
      await saveGameStats(gameID, wTeam, wScore, lTeam, lScore);
      await saveWinnerToDatabase(wTeam);
      console.log(`Winner ${wTeam} saved to the database. Game ID: ${gameID}`);
      // Find the player who has the winning team
      const playerId = await findPlayerWithTeam(wTeam);
      if (playerId) {
        // Increment the titleDefenses for the player
        await incrementTitleDefense(playerId);
        console.log(
          `Incremented titleDefenses for player ${playerId} with team ${wTeam}`
        );
      } else {
        console.log(`No player found with the team ${wTeam}`);
      }
    } else {
      console.log(`Game ${gameID} has not finished yet, no winner saved`);
      return;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: result.wTeam
          ? `Winner ${result.wTeam} saved`
          : `Game ${gameID} saved`,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process request' }),
    };
  }
};
