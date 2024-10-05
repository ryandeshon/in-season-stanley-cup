import AWS from 'aws-sdk';

// Set up the AWS configuration
AWS.config.update({
  region: 'us-east-1', // Replace with your DynamoDB table's region
  accessKeyId: process.env.VUE_APP_AWS_ACCESS_KEY_ID, // Use environment variables to store sensitive data
  secretAccessKey: process.env.VUE_APP_AWS_SECRET_ACCESS_KEY,
});

// Export the configured AWS object
export default AWS;
