import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'GameOptions';
const PLAYERS_TABLE = 'Players';
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
    console.error("Error retrieving game ID:", error);
    throw new Error("Failed to retrieve game ID");
  }
}

// Query the NHL API to check the game status and get the result
async function checkGameResult(gameID) {
  const apiUrl = `${API_URL}/gamecenter/${gameID}/boxscore`; // Adjust to match the endpoint for game details

  return new Promise((resolve, reject) => {
    https.get(apiUrl, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        const gameData = JSON.parse(data);
        const homeTeam = gameData.homeTeam;
        const awayTeam = gameData.awayTeam;

        // Check if the game is completed
        if (gameData.gameState === "FINAL") {
          // Determine the winner
          const winner = homeTeam.score > awayTeam.score ? homeTeam.abbrev : awayTeam.abbrev;
          resolve(winner);
        } else {
          console.log(`Game ${gameID}: ${homeTeam.abbrev} vs. ${awayTeam.abbrev} has not finished yet. (Status: ${gameData.gameState})`);
          resolve(null); // Game hasn't finished
        }
      });
    }).on('error', (e) => {
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
    const player = result.Items.find(player => player.teams.includes(team));
    return player ? player.id : null;
  } catch (error) {
    console.error("Error scanning Players table:", error);
    throw new Error("Failed to find player with winning team");
  }
}

// Function to increment the titleDefenses field for the winning player
async function incrementTitleDefense(playerId) {
  const params = {
    TableName: PLAYERS_TABLE,
    Key: { id: playerId },
    UpdateExpression: 'SET titleDefenses = titleDefenses + :inc',
    ExpressionAttributeValues: { ':inc': 1 },
  };

  await dynamoDB.update(params).promise();
}

// Main handler
export const handler = async (event) => {
  try {
    const gameID = await getGameID();
    // If there is no game stop checking
    if (!gameID) return;

    // Check the game result
    const winner = await checkGameResult(gameID);

    if (winner) {
      // Save the winner to DynamoDB
      await saveWinnerToDatabase(winner);
      console.log(`Winner ${winner} saved to the database`);
      // Find the player who has the winning team
      const playerId = await findPlayerWithTeam(winner);
      if (playerId) {
        // Increment the titleDefenses for the player
        await incrementTitleDefense(playerId);
        console.log(`Incremented titleDefenses for player ${playerId} with team ${winner}`);
      } else {
        console.log(`No player found with the team ${winner}`);
      }
    } else {
      console.log(`Game ${gameID} has not finished yet, no winner saved`);
      return;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: winner ? `Winner ${winner} saved` : `Game ${gameID} saved` }),
    };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process request' }) };
  }
};
