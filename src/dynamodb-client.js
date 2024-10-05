import AWS from './aws-config';

// Create a DynamoDB DocumentClient instance
const dynamodb = new AWS.DynamoDB.DocumentClient();

export default dynamodb;
