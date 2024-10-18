import AWS from './aws-config';

// Create a DynamoDB DocumentClient instance
// Configure the AWS SDK with the region
AWS.config.update({
  region: process.env.VUE_APP_AWS_REGION || 'us-east-1', // Replace 'us-east-1' with your region
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
export default dynamodb;
