const { CacheKeys, Time } = require('librechat-data-provider');
const getLogStores = require('~/cache/getLogStores');

/**
 * Cache key generators for different tool access patterns
 */
const ToolCacheKeys = {
  /** Global tools available to all users */
  GLOBAL: 'tools:global',
  /** MCP tools cached by owner ID and server name */
  MCP_SERVER: (ownerId, serverName) => `tools:mcp:${ownerId}:${serverName}`,
};

/**
 * Retrieves available tools from cache
 * @function getCachedTools
 * @param {Object} options - Options for retrieving tools
 * @param {string} [options.ownerId] - Owner ID (server owner) for MCP tools
 * @param {string} [options.serverName] - MCP server name to get cached tools for
 * @returns {Promise<LCAvailableTools|null>} The available tools object or null if not cached
 */
async function getCachedTools(options = {}) {
  const cache = getLogStores(CacheKeys.TOOL_CACHE);
  const { ownerId, serverName } = options;

  // Return MCP server-specific tools if requested
  if (serverName && ownerId) {
    const cacheKey = ToolCacheKeys.MCP_SERVER(ownerId, serverName);
    console.log(`[MCP TOOLS CACHE] getCachedTools: Looking for ownerId=${ownerId}, serverName=${serverName}`);
    console.log(`[MCP TOOLS CACHE] getCachedTools: Cache key = ${cacheKey}`);
    const result = await cache.get(cacheKey);
    console.log(`[MCP TOOLS CACHE] getCachedTools: Found tools? ${!!result}`);
    if (result) {
      console.log(`[MCP TOOLS CACHE] getCachedTools: Tools available: ${Object.keys(result).join(', ')}`);
    }
    return result;
  }

  // Default to global tools
  console.log(`[MCP TOOLS CACHE] getCachedTools: Getting GLOBAL tools (no ownerId/serverName specified)`);
  return await cache.get(ToolCacheKeys.GLOBAL);
}

/**
 * Sets available tools in cache
 * @function setCachedTools
 * @param {Object} tools - The tools object to cache
 * @param {Object} options - Options for caching tools
 * @param {string} [options.ownerId] - Owner ID (server owner) for MCP tools
 * @param {string} [options.serverName] - MCP server name for server-specific tools
 * @param {number} [options.ttl] - Time to live in milliseconds (default: 12 hours)
 * @returns {Promise<boolean>} Whether the operation was successful
 */
async function setCachedTools(tools, options = {}) {
  const cache = getLogStores(CacheKeys.TOOL_CACHE);
  const { ownerId, serverName, ttl = Time.TWELVE_HOURS } = options;

  // Cache by MCP server if specified (requires ownerId)
  if (serverName && ownerId) {
    return await cache.set(ToolCacheKeys.MCP_SERVER(ownerId, serverName), tools, ttl);
  }

  // Default to global cache
  return await cache.set(ToolCacheKeys.GLOBAL, tools, ttl);
}

/**
 * Invalidates cached tools
 * @function invalidateCachedTools
 * @param {Object} options - Options for invalidating tools
 * @param {string} [options.ownerId] - Owner ID for MCP tools
 * @param {string} [options.serverName] - MCP server name to invalidate
 * @param {boolean} [options.invalidateGlobal=false] - Whether to invalidate global tools
 * @returns {Promise<void>}
 */
async function invalidateCachedTools(options = {}) {
  const cache = getLogStores(CacheKeys.TOOL_CACHE);
  const { ownerId, serverName, invalidateGlobal = false } = options;

  const keysToDelete = [];

  if (invalidateGlobal) {
    keysToDelete.push(ToolCacheKeys.GLOBAL);
  }

  if (serverName && ownerId) {
    keysToDelete.push(ToolCacheKeys.MCP_SERVER(ownerId, serverName));
  }

  await Promise.all(keysToDelete.map((key) => cache.delete(key)));
}

/**
 * Gets MCP tools for a specific server from cache
 * @function getMCPServerTools
 * @param {string} ownerId - The server owner ID
 * @param {string} serverName - The MCP server name
 * @returns {Promise<LCAvailableTools|null>} The available tools for the server
 */
async function getMCPServerTools(ownerId, serverName) {
  const cache = getLogStores(CacheKeys.TOOL_CACHE);
  const serverTools = await cache.get(ToolCacheKeys.MCP_SERVER(ownerId, serverName));

  if (serverTools) {
    return serverTools;
  }

  return null;
}

module.exports = {
  ToolCacheKeys,
  getCachedTools,
  setCachedTools,
  getMCPServerTools,
  invalidateCachedTools,
};
