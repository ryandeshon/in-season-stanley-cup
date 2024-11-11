import dynamodb from '../dynamodb-client';

// Function to get a player's data by name
export const getPlayerData = async (playerName) => {
  const params = {
    TableName: 'Players',
    IndexName: 'NameIndex',
    KeyConditionExpression: '#n = :name', // Use a placeholder for `name`
    ExpressionAttributeNames: {
      '#n': 'name',                       // Define `#n` as the placeholder for `name`
    },
    ExpressionAttributeValues: {
      ':name': playerName,                // Bind the playerName parameter to `:name`
    },
  };

  try {
    const data = await dynamodb.query(params).promise();
    console.log('Player data:', data.Items[0]); // Log and return the first matched item
    return data.Items[0];                       // Assuming `name` is unique, return the first result
  } catch (error) {
    console.error('Error fetching player data:', error);
    throw error;
  }
};

// Function to get all players
export const getAllPlayers = async () => {
  const params = {
    TableName: 'Players'
  };

  try {
    const data = await dynamodb.scan(params).promise();
    return data.Items;
  } catch (error) {
    console.error('Error fetching all players:', error);
    throw error;
  }
};

export const getGameRecords = async () => {
  const params = {
    TableName: 'GameRecords'
  };

  try {
    const data = await dynamodb.scan(params).promise();
    return data.Items;
  } catch (error) {
    console.error('Error fetching game records:', error);
    throw error;
  }
};

// Function to update a player's attributes dynamically
export const updatePlayerAttributes = async (playerName, updatedAttributes) => {
  // Construct the UpdateExpression and ExpressionAttributeValues dynamically
  const updateExpression = Object.keys(updatedAttributes)
    .map(attr => `#${attr} = :${attr}`)
    .join(', ');

  const expressionAttributeNames = Object.keys(updatedAttributes).reduce((acc, attr) => {
    acc[`#${attr}`] = attr;
    return acc;
  }, {});

  const expressionAttributeValues = Object.keys(updatedAttributes).reduce((acc, attr) => {
    acc[`:${attr}`] = updatedAttributes[attr];
    return acc;
  }, {});

  // Define the DynamoDB update parameters
  const params = {
    TableName: 'Players',
    Key: { name: playerName },
    UpdateExpression: `SET ${updateExpression}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'UPDATED_NEW',
  };

  try {
    // Perform the update operation
    const result = await dynamodb.update(params).promise();
    console.log('Player attributes updated:', result);
    return result;
  } catch (error) {
    console.error('Error updating player attributes:', error);
    throw error;
  }
};
