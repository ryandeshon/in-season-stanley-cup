import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// Keep repository contracts (including conditional-write errors) unchanged
// while using the smaller SDK provided by the Node 22 Lambda runtime.
export function documentAdapter(client) {
  return Object.fromEntries(
    Object.entries({
      get: GetCommand,
      put: PutCommand,
      update: UpdateCommand,
      scan: ScanCommand,
      query: QueryCommand,
      transactWrite: TransactWriteCommand,
    }).map(([name, Command]) => [
      name,
      (params) => ({
        promise: async () => {
          try {
            return await client.send(new Command(params));
          } catch (error) {
            error.code = error.code || error.name;
            throw error;
          }
        },
      }),
    ])
  );
}
