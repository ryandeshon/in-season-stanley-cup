import dynamodb from '../dynamodb-client';

// Function to get a player's data by name
export const getPlayerData = async (playerName) => {
  const params = {
    TableName: 'Players',
    IndexName: 'NameIndex',
    KeyConditionExpression: '#n = :name', // Use a placeholder for `name`
    ExpressionAttributeNames: {
      '#n': 'name', // Define `#n` as the placeholder for `name`
    },
    ExpressionAttributeValues: {
      ':name': playerName, // Bind the playerName parameter to `:name`
    },
  };

  try {
    const data = await dynamodb.query(params).promise();
    console.log('Player data:', data.Items[0]); // Log and return the first matched item
    return data.Items[0]; // Assuming `name` is unique, return the first result
  } catch (error) {
    console.error('Error fetching player data:', error);
    throw error;
  }
};

// Function to get all players
export const getAllPlayers = async () => {
  const params = {
    TableName: 'Players',
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
    TableName: 'GameRecords',
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
    .map((attr) => `#${attr} = :${attr}`)
    .join(', ');

  const expressionAttributeNames = Object.keys(updatedAttributes).reduce(
    (acc, attr) => {
      acc[`#${attr}`] = attr;
      return acc;
    },
    {}
  );

  const expressionAttributeValues = Object.keys(updatedAttributes).reduce(
    (acc, attr) => {
      acc[`:${attr}`] = updatedAttributes[attr];
      return acc;
    },
    {}
  );

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

// Get Draft Players
export const getDraftPlayers = async () => {
  const params = {
    TableName: 'PlayersDraft', // ← Updated table
  };

  try {
    const data = await dynamodb.scan(params).promise();
    return data.Items;
  } catch (error) {
    console.error('Error fetching all players:', error);
    throw error;
  }
};

// ✅ Fetch Draft State
export const getDraftState = async () => {
  const params = {
    TableName: 'DraftState',
    Key: { draftId: 'current' },
  };

  try {
    const result = await dynamodb.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error fetching draft state:', error);
    throw error;
  }
};

// ✅ Update Draft State
export const updateDraftState = async (updatedAttributes) => {
  const updateExpression = Object.keys(updatedAttributes)
    .map((attr) => `#${attr} = :${attr}`)
    .join(', ');

  const expressionAttributeNames = Object.keys(updatedAttributes).reduce(
    (acc, attr) => {
      acc[`#${attr}`] = attr;
      return acc;
    },
    {}
  );

  const expressionAttributeValues = Object.keys(updatedAttributes).reduce(
    (acc, attr) => {
      acc[`:${attr}`] = updatedAttributes[attr];
      return acc;
    },
    {}
  );

  const params = {
    TableName: 'DraftState',
    Key: { draftId: 'current' },
    UpdateExpression: `SET ${updateExpression}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'UPDATED_NEW',
  };

  try {
    const result = await dynamodb.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error('Error updating draft state:', error);
    throw error;
  }
};

// ✅ Add Selected Team to Player
export const addTeamToPlayer = async (playerName, teamAbbreviation) => {
  const player = await getPlayerData(playerName);

  if (!player) {
    throw new Error('Player not found');
  }

  const params = {
    TableName: 'PlayersDraft',
    Key: { playerId: player.playerId },
    UpdateExpression:
      'SET #teams = list_append(if_not_exists(#teams, :emptyList), :newTeam)',
    ExpressionAttributeNames: {
      '#teams': 'teams',
    },
    ExpressionAttributeValues: {
      ':newTeam': [teamAbbreviation],
      ':emptyList': [],
    },
    ReturnValues: 'UPDATED_NEW',
  };

  try {
    const result = await dynamodb.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error('Error adding team to player:', error);
    throw error;
  }
};

// ✅ Select Team for Player
export const selectTeamForPlayer = async (playerId, teamAbbreviation) => {
  const params = {
    TableName: 'PlayersDraft',
    Key: { id: playerId },
    UpdateExpression:
      'SET teams = list_append(if_not_exists(teams, :emptyList), :team)',
    ExpressionAttributeValues: {
      ':team': [teamAbbreviation],
      ':emptyList': [],
    },
  };

  try {
    const result = await dynamodb.update(params).promise();
    return result;
  } catch (error) {
    console.error('Error updating player teams:', error);
    throw error;
  }
};

// ✅ Reset All Player Teams
export const resetAllPlayerTeams = async () => {
  const allPlayers = await getDraftPlayers(); // make sure this fetches from PlayersDraft

  const updatePromises = allPlayers.map((player) => {
    return dynamodb
      .update({
        TableName: 'PlayersDraft',
        Key: { id: player.id },
        UpdateExpression: 'REMOVE teams',
      })
      .promise();
  });

  try {
    await Promise.all(updatePromises);
    return true;
  } catch (error) {
    console.error('Error resetting player teams:', error);
    throw error;
  }
};
