class DocumentClient {
  constructor() {
    if (!global.__awsDocumentClientMock) {
      throw new Error('Global __awsDocumentClientMock is not configured.');
    }
    return global.__awsDocumentClientMock;
  }
}

export default {
  DynamoDB: {
    DocumentClient,
  },
};
