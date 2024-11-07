import dynamodb from '../dynamodb-client';

const params = {
  TableName: 'GameOptions',
  Key: { id: 'currentChampion' },
};

export const getCurrentChampion = async () => {
  try {
    const result = await dynamodb.get(params).promise();
    return result.Item ? result.Item.champion : null;
  } catch (error) {
    console.error("Error retrieving current champion:", error);
    throw new Error("Failed to retrieve current champion");
  }
};

export const getGameId = async () => {
  try {
    const result = await dynamodb.get(params).promise();
    return result.Item ? result.Item.gameID : null;
  } catch (error) {
    console.error("Error retrieving current gameID:", error);
    throw new Error("Failed to retrieve current gameID");
  }
};