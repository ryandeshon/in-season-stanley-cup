import dynamodb from '../dynamodb-client';

export const getCurrentChampion = async () => {
  const params = {
    TableName: 'GameOptions',
    Key: { id: 'currentChampion' },
  };

  try {
    const result = await dynamodb.get(params).promise();
    return result.Item ? result.Item.champion : null;
  } catch (error) {
    console.error("Error retrieving current champion:", error);
    throw new Error("Failed to retrieve current champion");
  }
};