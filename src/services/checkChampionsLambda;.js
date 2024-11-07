import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'GameOptions';
const PARTITION_KEY = 'currentChampion';
const API_URL = process.env.API_URL; // Use an environment variable for the API URL

// Helper function to get today's date in yyyy-mm-dd format
function getTodayDate() {
  const today = new Date();
  // Adjust for 3am run time by subtracting 3 hours
  today.setHours(today.getHours() - 3);
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Get the current champion from the database
async function getCurrentChampion() {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
  };

  try {
    const result = await dynamoDB.get(params).promise();
    console.log("🚀 ~ getCurrentChampion ~ result:", result)
    return result.Item ? result.Item.champion : null;
  } catch (error) {
    console.error("Error retrieving current champion:", error);
    throw new Error("Failed to retrieve current champion");
  }
}

async function getGameWinner() {
  const todayDate = getTodayDate();
  const apiUrl = `${API_URL}/schedule/${todayDate}`;

  return new Promise((resolve, reject) => {
    https.get(apiUrl, (response) => {
      let data = '';
      console.log(`Request URL: ${apiUrl}`);
      console.log(`Response Status Code: ${response.statusCode}`);

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        console.log(`Raw Response Data: ${data}`);
        const jsonData = JSON.parse(data);
        const winner = jsonData.winner; // Adjust based on actual API response structure
        console.log(`Parsed Winner: ${winner}`);
        resolve(winner);
      });
    }).on('error', (e) => {
      console.error('API Request Error:', e);
      reject(e);
    });
  });
} 

async function updateChampionInDatabase(winner) {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: 'set champion = :champion',
    ExpressionAttributeValues: { ':champion': winner },
  };
  await dynamoDB.update(params).promise();
}

export const handler = async (event) => {
  try {
    // Fetch the current champion
    const currentChampion = await getCurrentChampion();
    console.log(`Current champion: ${currentChampion}`);
    
    // const winner = await getGameWinner();
    // await updateChampionInDatabase(winner);
    // console.log(`Successfully updated champion to: ${winner}`);
    return { statusCode: 200, body: JSON.stringify({ message: `Champion updated to ` }) };
  } catch (error) {
    console.error('Error updating champion:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to update champion' }) };
  }
};

