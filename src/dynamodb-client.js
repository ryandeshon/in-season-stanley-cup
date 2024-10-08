import AWS from './aws-config';

// Configure AWS with the correct region
AWS.config.update({
  region: process.env.VUE_APP_AWS_REGION || 'us-east-1', // Replace 'us-east-1' with your region if needed
  accessKeyId: process.env.VUE_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.VUE_APP_AWS_SECRET_ACCESS_KEY,
});

// Create a DynamoDB DocumentClient instance
const dynamodb = new AWS.DynamoDB.DocumentClient();

export default dynamodb;
