const { logger } = require('@librechat/data-schemas');
const { CacheKeys, Constants } = require('librechat-data-provider');
const { getCachedTools, setCachedTools } = require('./getCachedTools');
const { getLogStores } = require('~/cache');

/**
 * Updates MCP tools in the cache for a specific server
 * @param {Object} params - Parameters for updating MCP tools
 * @param {string} params.ownerId - Server owner ID for caching
 * @param {string} params.serverName - MCP server name
 * @param {Array} params.tools - Array of tool objects from MCP server
 * @returns {Promise<LCAvailableTools>}
 */
async function updateMCPServerTools({ ownerId, serverName, tools }) {
  try {
    const serverTools = {};
    const mcpDelimiter = Constants.mcp_delimiter;

    logger.info(`[MCP TOOLS CACHE] server=${serverName} ownerId=${ownerId}`);

    if (tools == null || tools.length === 0) {
      logger.debug(`[MCP Cache] No tools to update for server ${serverName} (owner: ${ownerId})`);
      logger.info(`[MCP AUDIT] WARNING: No tools found for ${serverName}!`);
      return serverTools;
    }

    for (const tool of tools) {
      const name = `${tool.name}${mcpDelimiter}${serverName}`;
      serverTools[name] = {
        type: 'function',
        ['function']: {
          name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      };
    }

    logger.info(`[MCP AUDIT] Building tool definitions: ${Object.keys(serverTools).join(', ')}`);

    await setCachedTools(serverTools, { ownerId, serverName });

    const cache = getLogStores(CacheKeys.TOOL_CACHE);
    await cache.delete(CacheKeys.TOOLS);
    logger.debug(
      `[MCP Cache] Updated ${tools.length} tools for server ${serverName} (owner: ${ownerId})`,
    );
    logger.info(`[MCP AUDIT] Tools cached successfully: ${tools.length} tools`);
    return serverTools;
  } catch (error) {
    logger.error(`[MCP Cache] Failed to update tools for ${serverName} (owner: ${ownerId}):`, error);
    throw error;
  }
}

/**
 * Merges app-level tools with global tools
 * @param {import('@librechat/api').LCAvailableTools} appTools
 * @returns {Promise<void>}
 */
async function mergeAppTools(appTools) {
  try {
    const count = Object.keys(appTools).length;
    if (!count) {
      return;
    }
    const cachedTools = await getCachedTools();
    const mergedTools = { ...cachedTools, ...appTools };
    await setCachedTools(mergedTools);
    const cache = getLogStores(CacheKeys.TOOL_CACHE);
    await cache.delete(CacheKeys.TOOLS);
    logger.debug(`Merged ${count} app-level tools`);
  } catch (error) {
    logger.error('Failed to merge app-level tools:', error);
    throw error;
  }
}

/**
 * Caches MCP server tools (no longer merges with global)
 * @param {object} params
 * @param {string} params.ownerId - Server owner ID for caching
 * @param {string} params.serverName
 * @param {import('@librechat/api').LCAvailableTools} params.serverTools
 * @returns {Promise<void>}
 */
async function cacheMCPServerTools({ ownerId, serverName, serverTools }) {
  try {
    const count = Object.keys(serverTools).length;
    if (!count) {
      return;
    }
    // Only cache server-specific tools, no merging with global
    await setCachedTools(serverTools, { ownerId, serverName });
    logger.debug(`Cached ${count} MCP server tools for ${serverName} (owner: ${ownerId})`);
  } catch (error) {
    logger.error(`Failed to cache MCP server tools for ${serverName} (owner: ${ownerId}):`, error);
    throw error;
  }
}

module.exports = {
  mergeAppTools,
  cacheMCPServerTools,
  updateMCPServerTools,
};
