import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'GameOptions';
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
        if (gameData.gameState === "OFF") {
          // Determine the winner
          const winner = homeTeam.score > awayTeam.score ? homeTeam.abbrev : awayTeam.abbrev;
          resolve(winner);
        } else {
          console.log(`Game ${gameID}: ${homeTeam.abbrev} vs. ${awayTeam.abbrev} has not finished yet.`);
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

// Main handler
export const handler = async (event) => {
  try {
    const gameID = await getGameID();
    if (!gameID) {
      throw new Error("No game ID found in the database");
    }

    // Check the game result
    const winner = await checkGameResult(gameID);

    if (winner) {
      // Save the winner to DynamoDB
      await saveWinnerToDatabase(winner);
      console.log(`Winner ${winner} saved to the database`);
    } else {
      console.log(`Game ${gameID} has not finished yet, no winner saved`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: winner ? `Winner ${winner} saved` : `Game ${gameID} not finished yet` }),
    };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process request' }) };
  }
};
