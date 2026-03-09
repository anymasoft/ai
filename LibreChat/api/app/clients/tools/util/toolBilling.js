const { logger } = require('@librechat/data-schemas');
const { checkBalanceRecord } = require('~/models/balanceMethods');
const { createTransaction } = require('~/models/Transaction');

/**
 * Tool billing configuration
 * Maps tool names to their cost in tokens
 */
const TOOL_COSTS = {
  tavily_search_results_json: 1000,
  'tavily_search': 1000,
};

/**
 * Creates a wrapper around a LangChain tool to add billing functionality
 *
 * @param {import('@langchain/core/tools').Tool} tool - The LangChain tool to wrap
 * @param {string} toolName - The name of the tool (used for billing)
 * @param {string} userId - The user ID for billing
 * @param {object} options - Additional options
 * @param {string} [options.conversationId] - The conversation ID for context
 * @param {string} [options.messageId] - The message ID for context
 * @returns {import('@langchain/core/tools').Tool} - The wrapped tool with billing
 */
function createBilledTool(tool, toolName, userId, options = {}) {
  const cost = TOOL_COSTS[toolName];

  if (!cost) {
    logger.warn(`[Tool Billing] No cost configured for tool: ${toolName}`);
    return tool;
  }

  if (!userId) {
    logger.warn(`[Tool Billing] No user ID provided, skipping billing for tool: ${toolName}`);
    return tool;
  }

  // Store the original _call method
  const originalCall = tool._call.bind(tool);

  // Replace _call with a wrapped version that includes billing
  tool._call = async function (input, runManager) {
    return billedToolCall(
      originalCall,
      input,
      runManager,
      toolName,
      userId,
      cost,
      options,
    );
  };

  return tool;
}

/**
 * Executes a tool call with billing
 *
 * @param {Function} originalCall - The original tool _call method
 * @param {any} input - The tool input
 * @param {any} runManager - The LangChain run manager
 * @param {string} toolName - The name of the tool
 * @param {string} userId - The user ID
 * @param {number} cost - The cost in tokens
 * @param {object} options - Additional options
 * @returns {Promise<any>} - The tool output
 */
async function billedToolCall(
  originalCall,
  input,
  runManager,
  toolName,
  userId,
  cost,
  options = {},
) {
  try {
    // 1. Check if user has sufficient balance
    logger.info(`[TAVILY BILLING] Checking balance for user=${userId} cost=${cost}`);

    const balanceCheck = await checkBalanceRecord({
      user: userId,
      model: 'tool',
      tokenType: 'tool',
      amount: cost,
      endpoint: 'tool',
      valueKey: 'tool',
    });

    if (!balanceCheck.canSpend) {
      const errorMessage = `Insufficient tokens for ${toolName}. Required: ${cost}, Available: ${balanceCheck.balance}`;
      logger.warn(`[TAVILY BILLING] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    logger.info(`[TAVILY BILLING] user=${userId} cost=${cost} balance_before=${balanceCheck.balance}`);

    // 2. Execute the tool
    const result = await originalCall(input, runManager);

    // 3. Record the billing transaction
    try {
      const { Transaction } = require('~/db/models');
      const { updateBalance } = require('~/models');

      const txData = {
        user: userId,
        context: 'tool',
        toolName: toolName,
        tokenType: 'tool',
        rawAmount: -cost,
        conversationId: options.conversationId,
        messageId: options.messageId,
      };

      const transaction = new Transaction(txData);
      // For tools, set rate and tokenValue directly without getMultiplier
      transaction.rate = 1;
      transaction.tokenValue = -cost; // Negative because it's spending

      await transaction.save();

      // Update user balance
      await updateBalance({
        user: userId,
        incrementValue: -cost,
      });

      logger.info(`[TAVILY BILLING] Transaction recorded for user=${userId} tool=${toolName} cost=${cost}`);
    } catch (transactionError) {
      logger.error(
        `[TAVILY BILLING] Failed to record transaction for user=${userId} tool=${toolName}`,
        transactionError,
      );
      // Don't throw here - tool already executed successfully
      // Just log the error for manual reconciliation
    }

    return result;
  } catch (error) {
    logger.error(`[TAVILY BILLING] Error in billedToolCall for user=${userId}`, error);
    throw error;
  }
}

module.exports = {
  TOOL_COSTS,
  createBilledTool,
};
