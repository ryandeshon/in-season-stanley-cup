import https from 'https';
import AWS from 'aws-sdk';
import { createHttpHandler } from './handler.js';

export const handler = createHttpHandler({
  https,
  dynamoDB: new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
});
