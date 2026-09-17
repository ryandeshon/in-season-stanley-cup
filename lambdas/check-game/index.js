const https = require('https');
const AWS = require('aws-sdk');
const { createChecker } = require('./handler.cjs');
const region = process.env.AWS_REGION || 'us-east-1';
module.exports.handler = createChecker({
  https,
  dynamoDB: new AWS.DynamoDB.DocumentClient({ region }),
  cloudFront: new AWS.CloudFront({ region }),
  scheduler: AWS.Scheduler ? new AWS.Scheduler({ region }) : null,
});
