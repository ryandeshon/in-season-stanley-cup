const AWS = require('aws-sdk');
require('dotenv').config(); // Load environment variables from .env file

// Set up the AWS configuration
AWS.config.update({
  region: process.env.VUE_APP_AWS_REGION || 'us-east-1', // Use environment variables to store sensitive data
  accessKeyId: process.env.VUE_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.VUE_APP_AWS_SECRET_ACCESS_KEY,
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Sample data to seed the Players table
const players = [
  {
    id: "0",
    name: "Ryan",
    teams: ["BOS", "NYR", "WPG", "NSH", "PHI", "PIT", "OTT", "SJS"],
    daysAsChampion: 0,
    titleDefenses: 0,
    championships: 0
  },
  {
    id: "1",
    name: "Cooper",
    teams: ["FLA", "TOR", "DAL", "MIN", "SEA", "UTA", "WSH", "STL"],
    daysAsChampion: 0,
    titleDefenses: 0,
    championships: 0
  },
  {
    id: "2",
    name: "Terry",
    teams: ["VAN", "COL", "DET", "NJD", "CHI", "MTL", "ANA", "CGY"],
    daysAsChampion: 0,
    titleDefenses: 0,
    championships: 0
  },
  {
    id: "3",
    name: "Boz",
    teams: ["EDM", "VGK", "CAR", "TBL", "NYI", "LAK", "BUF", "CBJ"],
    daysAsChampion: 0,
    titleDefenses: 0,
    championships: 0
  }
];

// Function to seed the data
const seedData = async () => {
  for (const player of players) {
    const params = {
      TableName: 'Players', // Replace with your DynamoDB table name
      Item: player
    };

    try {
      await dynamodb.put(params).promise();
      console.log(`Inserted player: ${player.name}`);
    } catch (error) {
      console.error(`Failed to insert player: ${player.name}`, error);
    }
  }
};

seedData();
