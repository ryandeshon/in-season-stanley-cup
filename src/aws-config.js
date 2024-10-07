import AWS from 'aws-sdk';

// Set up the AWS configuration
AWS.config.update({
  region: process.env.VUE_APP_AWS_REGION, // Use environment variables to store sensitive data
  accessKeyId: process.env.VUE_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.VUE_APP_AWS_SECRET_ACCESS_KEY,
});

console.log('AWS Config:', AWS.config);

// Export the configured AWS object
export default AWS;
