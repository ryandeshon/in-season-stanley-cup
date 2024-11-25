import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'GameOptions';
const PARTITION_KEY = 'currentChampion';
const API_URL = process.env.API_URL; // Your API Gateway URL that proxies to the NHL API

// Helper function to get today's date in yyyy-mm-dd format
function getTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Get the current champion from DynamoDB
async function getCurrentChampion() {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
  };

  try {
    const result = await dynamoDB.get(params).promise();
    return result.Item ? result.Item.champion : null;
  } catch (error) {
    console.error('Error retrieving current champion:', error);
    throw new Error('Failed to retrieve current champion');
  }
}

// Query the NHL API to see if the champion is playing today
async function checkGameForChampion(champion) {
  const todayDate = getTodayDate();
  const apiUrl = `${API_URL}/schedule/${todayDate}`; // Replace with the correct endpoint for schedule

  return new Promise((resolve, reject) => {
    https
      .get(apiUrl, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          const jsonData = JSON.parse(data);
          const gameWeek = jsonData.gameWeek;
          const todayGames = gameWeek.find(
            (day) => day.date === todayDate
          )?.games;
          if (!todayGames) {
            return resolve(null);
          }
          const game = todayGames.find(
            (game) =>
              game.homeTeam.abbrev === champion ||
              game.awayTeam.abbrev === champion
          );
          if (game) {
            resolve(game.id); // Return the game ID
          } else {
            resolve(null);
          }
        });
      })
      .on('error', (e) => {
        console.error('API Request Error:', e);
        reject(e);
      });
  });
}

// Save the game ID to DynamoDB
async function saveGameIDToDatabase(gameID) {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: 'set gameID = :gameID',
    ExpressionAttributeValues: { ':gameID': gameID },
  };
  await dynamoDB.update(params).promise();
}

// Main handler
export const handler = async (event) => {
  try {
    const champion = await getCurrentChampion();
    if (!champion) {
      throw new Error('No current champion found in the database');
    }

    // Check if there's a game for the champion today
    const gameID = await checkGameForChampion(champion);

    if (gameID) {
      // Save the game ID to DynamoDB
      await saveGameIDToDatabase(gameID);
      console.log(`Game ID ${gameID} saved for champion ${champion}`);
    } else {
      // Set todays gameID to null
      await saveGameIDToDatabase(null);
      console.log(`No game scheduled for champion ${champion} today`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: gameID
          ? `Game ID ${gameID} saved for champion ${champion}`
          : `No game scheduled for champion ${champion} today`,
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
