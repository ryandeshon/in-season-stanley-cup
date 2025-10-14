// Utility functions for managing live game polling
import AWS from 'aws-sdk';

// Configure AWS SDK
const eventbridge = new AWS.EventBridge({
  region: 'us-east-1',
  accessKeyId: process.env.VUE_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.VUE_APP_AWS_SECRET_ACCESS_KEY,
});

const POLLING_RULE_NAME = 'GamePollingRule';

export const gamePollingService = {
  /**
   * Enable the EventBridge rule to start polling NHL API every 30 seconds
   */
  async enablePolling() {
    try {
      await eventbridge
        .enableRule({
          Name: POLLING_RULE_NAME,
        })
        .promise();
      console.log('✅ Live game polling enabled');
      return { success: true, message: 'Polling enabled' };
    } catch (error) {
      console.error('❌ Failed to enable polling:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Disable the EventBridge rule to stop polling NHL API
   */
  async disablePolling() {
    try {
      await eventbridge
        .disableRule({
          Name: POLLING_RULE_NAME,
        })
        .promise();
      console.log('⏹️ Live game polling disabled');
      return { success: true, message: 'Polling disabled' };
    } catch (error) {
      console.error('❌ Failed to disable polling:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if the polling rule is currently enabled
   */
  async getPollingStatus() {
    try {
      const result = await eventbridge
        .listRules({
          NamePrefix: POLLING_RULE_NAME,
        })
        .promise();

      const rule = result.Rules?.find((r) => r.Name === POLLING_RULE_NAME);
      if (!rule) {
        return { exists: false, enabled: false };
      }

      return {
        exists: true,
        enabled: rule.State === 'ENABLED',
        schedule: rule.ScheduleExpression,
      };
    } catch (error) {
      console.error('❌ Failed to get polling status:', error);
      return { exists: false, enabled: false, error: error.message };
    }
  },

  /**
   * Automatically manage polling based on game state
   * Call this when game state changes
   */
  async autoManagePolling(gameState) {
    const isGameLive = ['LIVE', 'CRIT'].includes(gameState);
    const currentStatus = await this.getPollingStatus();

    if (isGameLive && !currentStatus.enabled) {
      console.log('Game went live, enabling polling...');
      return await this.enablePolling();
    } else if (!isGameLive && currentStatus.enabled) {
      console.log('Game ended, disabling polling...');
      return await this.disablePolling();
    }

    return {
      success: true,
      message: `Polling already ${currentStatus.enabled ? 'enabled' : 'disabled'}`,
    };
  },
};

export default gamePollingService;
