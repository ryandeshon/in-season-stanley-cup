class DocumentClient {
  constructor() {
    if (!global.__awsDocumentClientMock) {
      throw new Error('Global __awsDocumentClientMock is not configured.');
    }
    return global.__awsDocumentClientMock;
  }
}

class CloudFront {
  constructor() {
    if (global.__awsCloudFrontMock) {
      return global.__awsCloudFrontMock;
    }
    return {
      createInvalidation() {
        return {
          promise: async () => ({
            Invalidation: {
              Id: 'mock-invalidation-id',
              Status: 'InProgress',
            },
          }),
        };
      },
    };
  }
}

export default {
  DynamoDB: {
    DocumentClient,
  },
  CloudFront,
};
