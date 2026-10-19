import https from 'https';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { documentAdapter } from './document-adapter.js';
import { createHttpHandler } from './handler.js';

export const handler = createHttpHandler({
  https,
  dynamoDB: documentAdapter(
    DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-east-1',
      }),
      { marshallOptions: { removeUndefinedValues: true } }
    )
  ),
});
