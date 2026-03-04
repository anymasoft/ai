/**
 * MCP Tools Controller
 * Handles MCP-specific tool endpoints, decoupled from regular LibreChat tools
 *
 * @import { MCPServerRegistry } from '@librechat/api'
 * @import { MCPServerDocument } from 'librechat-data-provider'
 */
const { logger } = require('@librechat/data-schemas');
const {
  isMCPDomainNotAllowedError,
  isMCPInspectionFailedError,
  MCPErrorCodes,
} = require('@librechat/api');
const { Constants, MCPServerUserInputSchema, SystemRoles } = require('librechat-data-provider');
const { cacheMCPServerTools, getMCPServerTools } = require('~/server/services/Config');
const { getMCPManager, getMCPServersRegistry } = require('~/config');
const { getMCPServersWithAdmins, getServerConfigWithAdminFallback, getAdminId } = require('~/server/services/MCP');
const { User } = require('~/db/models');

/**
 * Handles MCP-specific errors and sends appropriate HTTP responses.
 * @param {Error} error - The error to handle
 * @param {import('express').Response} res - Express response object
 * @returns {import('express').Response | null} Response if handled, null if not an MCP error
 */
function handleMCPError(error, res) {
  if (isMCPDomainNotAllowedError(error)) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
  }

  if (isMCPInspectionFailedError(error)) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
  }

  // Fallback for legacy string-based error handling (backwards compatibility)
  if (error.message?.startsWith(MCPErrorCodes.DOMAIN_NOT_ALLOWED)) {
    return res.status(403).json({
      error: MCPErrorCodes.DOMAIN_NOT_ALLOWED,
      message: error.message.replace(/^MCP_DOMAIN_NOT_ALLOWED\s*:\s*/i, ''),
    });
  }

  if (error.message?.startsWith(MCPErrorCodes.INSPECTION_FAILED)) {
    return res.status(400).json({
      error: MCPErrorCodes.INSPECTION_FAILED,
      message: error.message,
    });
  }

  return null;
}

/**
 * Get all MCP tools available to the user (user-specific + admin-created global)
 */
const getMCPTools = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('[getMCPTools] User ID not found in request');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // ДИАГНОСТИКА: ШАГ 1 - Точка входа
    logger.info(`[MCP DIAG] ===== getMCPTools called for user: ${userId}`);

    // Get user-specific server configs + admin-created servers
    const mcpConfig = await getMCPServersWithAdmins(userId);
    const configuredServers = mcpConfig ? Object.keys(mcpConfig) : [];

    logger.info(`[MCP AUDIT] getMCPTools: userId=${userId}, configured servers: ${configuredServers.join(', ')}`);
    logger.info(`[MCP DIAG] MCP servers configured: ${JSON.stringify(configuredServers)}`);

    if (!mcpConfig || Object.keys(mcpConfig).length == 0) {
      logger.warn(`[MCP DIAG] No MCP servers configured for user ${userId}`);
      return res.status(200).json({ servers: {} });
    }

    const mcpServers = {};

    // All MCP tools execute through admin's MCP manager
    const adminId = await getAdminId();
    logger.info(`[MCP AUDIT] getMCPTools: using adminId=${adminId}`);
    logger.info(`[MCP DIAG] Admin resolved: ${adminId}`);

    const cachePromises = configuredServers.map((serverName) => {
      return getMCPServerTools(adminId, serverName).then((tools) => ({ serverName, tools }));
    });
    const cacheResults = await Promise.all(cachePromises);

    const serverToolsMap = new Map();
    for (const { serverName, tools } of cacheResults) {
      // ДИАГНОСТИКА: ШАГ 2 - Обработка cached tools
      logger.info(`[MCP DIAG] Processing server: ${serverName}`);

      if (tools) {
        logger.info(`[MCP DIAG] Found cached tools for ${serverName}: ${Object.keys(tools).length} tools`);
        logger.info(`[MCP DIAG] Tool names: ${Object.keys(tools).slice(0, 5).join(', ')}${Object.keys(tools).length > 5 ? '...' : ''}`);
        serverToolsMap.set(serverName, tools);
        continue;
      }

      let serverTools;
      try {
        const mcpManager = getMCPManager(adminId);
        logger.info(`[MCP AUDIT] getMCPManager initialized with adminId=${adminId} for server=${serverName}`);
        logger.info(`[MCP DIAG] Discovering tools from server: ${serverName}`);

        serverTools = await mcpManager.getServerToolFunctions(userId, serverName);

        if (serverTools) {
          const toolNames = Object.keys(serverTools);
          logger.info(`[MCP DIAG] Tools discovered from server ${serverName}: ${toolNames.length} tools`);
          logger.info(`[MCP DIAG] Tool list: ${toolNames.join(', ')}`);
        }
      } catch (error) {
        logger.error(`[getMCPTools] Error fetching tools for server ${serverName}:`, error);
        logger.error(`[MCP DIAG] Failed to fetch tools for ${serverName}`);
        continue;
      }
      if (!serverTools) {
        logger.debug(`[getMCPTools] No tools found for server ${serverName}`);
        logger.warn(`[MCP DIAG] serverTools is null/undefined for ${serverName}`);
        continue;
      }
      serverToolsMap.set(serverName, serverTools);

      if (Object.keys(serverTools).length > 0) {
        // Cache asynchronously without blocking
        cacheMCPServerTools({ ownerId: adminId, serverName, serverTools }).catch((err) =>
          logger.error(`[getMCPTools] Failed to cache tools for ${serverName}:`, err),
        );
      }
    }

    // Process each configured server
    for (const serverName of configuredServers) {
      try {
        const serverTools = serverToolsMap.get(serverName);

        // Get server config once
        const serverConfig = mcpConfig[serverName];
        const rawServerConfig = await getServerConfigWithAdminFallback(serverName, userId);

        // Initialize server object with all server-level data
        const server = {
          name: serverName,
          icon: rawServerConfig?.iconPath || '',
          authenticated: true,
          authConfig: [],
          tools: [],
        };

        // Set authentication config once for the server
        if (serverConfig?.customUserVars) {
          const customVarKeys = Object.keys(serverConfig.customUserVars);
          if (customVarKeys.length > 0) {
            server.authConfig = Object.entries(serverConfig.customUserVars).map(([key, value]) => ({
              authField: key,
              label: value.title || key,
              description: value.description || '',
            }));
            server.authenticated = false;
          }
        }

        // Process tools efficiently - no need for convertMCPToolToPlugin
        if (serverTools) {
          logger.info(`[MCP DIAG] Processing ${Object.keys(serverTools).length} tools from server ${serverName}`);

          for (const [toolKey, toolData] of Object.entries(serverTools)) {
            if (!toolData.function || !toolKey.includes(Constants.mcp_delimiter)) {
              logger.debug(`[MCP DIAG] Skipping tool: ${toolKey} (missing function or delimiter)`);
              continue;
            }

            const toolName = toolKey.split(Constants.mcp_delimiter)[0];
            logger.info(`[MCP DIAG] Adding tool: ${toolName} (key: ${toolKey})`);

            server.tools.push({
              name: toolName,
              pluginKey: toolKey,
              description: toolData.function.description || '',
            });
          }
          logger.info(`[MCP DIAG] Server ${serverName} has ${server.tools.length} tools after processing`);
        } else {
          logger.warn(`[MCP DIAG] No serverTools found for ${serverName}`);
        }

        // Only add server if it has tools or is configured
        if (server.tools.length > 0 || serverConfig) {
          mcpServers[serverName] = server;
          logger.info(`[MCP DIAG] Added server ${serverName} with ${server.tools.length} tools`);
        }
      } catch (error) {
        logger.error(`[getMCPTools] Error loading tools for server ${serverName}:`, error);
        logger.error(`[MCP DIAG] Exception processing server ${serverName}`);
      }
    }

    // ДИАГНОСТИКА: ШАГ 3 - Результат перед возвратом
    const allTools = Object.values(mcpServers).flatMap(s => s.tools);
    logger.info(`[MCP DIAG] ===== getMCPTools completed. Total servers: ${Object.keys(mcpServers).length}, Total tools: ${allTools.length}`);
    logger.info(`[MCP DIAG] All tool names: ${allTools.map(t => t.name).join(', ')}`);

    res.status(200).json({ servers: mcpServers });
  } catch (error) {
    logger.error('[getMCPTools]', error);
    res.status(500).json({ message: error.message });
  }
};
/**
 * Get all MCP servers (user-specific + admin-created global)
 * @route GET /api/mcp/servers
 * Returns both user's personal servers and admin-created servers
 */
const getMCPServersList = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get user-specific server configs + admin-created servers
    const serverConfigs = await getMCPServersWithAdmins(userId);

    return res.json(serverConfigs);
  } catch (error) {
    logger.error('[getMCPServersList]', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create MCP server
 * @route POST /api/mcp/servers
 */
const createMCPServerController = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { config } = req.body;

    const validation = MCPServerUserInputSchema.safeParse(config);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid configuration',
        errors: validation.error.errors,
      });
    }

    // MCP servers are saved with user's userId
    // Admin-created servers will be accessible to all users via getAllServerConfigs query
    const result = await getMCPServersRegistry().addServer(
      'temp_server_name',
      validation.data,
      'DB',
      userId,
    );
    res.status(201).json({
      serverName: result.serverName,
      ...result.config,
    });
  } catch (error) {
    logger.error('[createMCPServer]', error);
    const mcpErrorResponse = handleMCPError(error, res);
    if (mcpErrorResponse) {
      return mcpErrorResponse;
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get MCP server by ID (user-specific or admin-created global)
 */
const getMCPServerById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { serverName } = req.params;
    if (!serverName) {
      return res.status(400).json({ message: 'Server name is required' });
    }

    // Get user-specific server config
    let parsedConfig = await getMCPServersRegistry().getServerConfig(serverName, userId);

    // If not found in user's servers, check admin servers
    if (!parsedConfig) {
      try {
        const admins = await User.find({ role: SystemRoles.ADMIN }, '_id').lean().exec();
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            const adminConfig = await getMCPServersRegistry().getServerConfig(
              serverName,
              admin._id.toString(),
            );
            if (adminConfig) {
              parsedConfig = adminConfig;
              break;
            }
          }
        }
      } catch (error) {
        logger.debug('[getMCPServerById] Error checking admin servers:', error);
      }
    }

    if (!parsedConfig) {
      return res.status(404).json({ message: 'MCP server not found' });
    }

    res.status(200).json(parsedConfig);
  } catch (error) {
    logger.error('[getMCPServerById]', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update MCP server
 * @route PATCH /api/mcp/servers/:serverName
 */
const updateMCPServerController = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { serverName } = req.params;
    const { config } = req.body;

    const validation = MCPServerUserInputSchema.safeParse(config);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid configuration',
        errors: validation.error.errors,
      });
    }

    // MCP servers are updated with user's userId
    const parsedConfig = await getMCPServersRegistry().updateServer(
      serverName,
      validation.data,
      'DB',
      userId,
    );

    res.status(200).json(parsedConfig);
  } catch (error) {
    logger.error('[updateMCPServer]', error);
    const mcpErrorResponse = handleMCPError(error, res);
    if (mcpErrorResponse) {
      return mcpErrorResponse;
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete MCP server
 * @route DELETE /api/mcp/servers/:serverName
 */
const deleteMCPServerController = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { serverName } = req.params;

    // MCP servers are removed using user's userId
    await getMCPServersRegistry().removeServer(serverName, 'DB', userId);
    res.status(200).json({ message: 'MCP server deleted successfully' });
  } catch (error) {
    logger.error('[deleteMCPServer]', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMCPTools,
  getMCPServersList,
  createMCPServerController,
  getMCPServerById,
  updateMCPServerController,
  deleteMCPServerController,
};
