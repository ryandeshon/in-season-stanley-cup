import AWS from 'aws-sdk';

// Configure AWS with environment variables
AWS.config.update({
  region: process.env.VUE_APP_AWS_REGION || 'us-east-1',
  accessKeyId: process.env.VUE_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.VUE_APP_AWS_SECRET_ACCESS_KEY,
});

// Create and export the DynamoDB client
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const getDynamoDBClient = async () => {
  return dynamoDb;
};

export default dynamoDb;
