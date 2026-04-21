const AWS = require('aws-sdk');

const cloudFront = new AWS.CloudFront({
  region: process.env.AWS_REGION || 'us-east-1',
});

const API_CACHE_DISTRIBUTION_ID = process.env.API_CACHE_DISTRIBUTION_ID || null;
const API_CACHE_INVALIDATION_PATHS = (
  process.env.API_CACHE_INVALIDATION_PATHS ||
  '/champion,/gameid,/season/meta,/players,/game-records,/check-status'
)
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean)
  .map((path) => (path.startsWith('/') ? path : `/${path}`));

function nowIso() {
  return new Date().toISOString();
}

exports.handler = async (event) => {
  if (!API_CACHE_DISTRIBUTION_ID) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ts: nowIso(),
        message: 'API cache distribution is not configured; skipping invalidation',
      }),
    };
  }

  const paths = API_CACHE_INVALIDATION_PATHS.length
    ? API_CACHE_INVALIDATION_PATHS
    : ['/champion', '/gameid', '/season/meta'];

  const callerReference = `monthly-cache-clear-${Date.now()}`;

  try {
    const result = await cloudFront
      .createInvalidation({
        DistributionId: API_CACHE_DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: callerReference,
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      })
      .promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ts: nowIso(),
        message: 'API cache invalidation requested',
        invalidationId: result?.Invalidation?.Id || null,
        status: result?.Invalidation?.Status || null,
        paths,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ts: nowIso(),
        error: 'Failed to request API cache invalidation',
        details: String(error),
      }),
    };
  }
};

