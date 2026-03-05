const { tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const {
  Providers,
  StepTypes,
  GraphEvents,
  Constants: AgentConstants,
} = require('@librechat/agents');
const {
  sendEvent,
  MCPOAuthHandler,
  isMCPDomainAllowed,
  normalizeServerName,
  normalizeJsonSchema,
  GenerationJobManager,
  resolveJsonSchemaRefs,
} = require('@librechat/api');
const {
  Time,
  CacheKeys,
  Constants,
  ContentTypes,
  isAssistantsEndpoint,
  SystemRoles,
} = require('librechat-data-provider');
const {
  getOAuthReconnectionManager,
  getMCPServersRegistry,
  getFlowStateManager,
  getMCPManager,
} = require('~/config');
const { findToken, createToken, updateToken } = require('~/models');
const { User } = require('~/db/models');
const { getGraphApiToken } = require('./GraphTokenService');
const { reinitMCPServer } = require('./Tools/mcp');
const { getAppConfig } = require('./Config');
const { getLogStores } = require('~/cache');

function isEmptyObjectSchema(jsonSchema) {
  return (
    jsonSchema != null &&
    typeof jsonSchema === 'object' &&
    jsonSchema.type === 'object' &&
    (jsonSchema.properties == null || Object.keys(jsonSchema.properties).length === 0) &&
    !jsonSchema.additionalProperties
  );
}

/**
 * @param {object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {string} params.stepId - The ID of the step in the flow.
 * @param {ToolCallChunk} params.toolCall - The tool call object containing tool information.
 * @param {string | null} [params.streamId] - The stream ID for resumable mode.
 */
function createRunStepDeltaEmitter({ res, stepId, toolCall, streamId = null }) {
  /**
   * @param {string} authURL - The URL to redirect the user for OAuth authentication.
   * @returns {Promise<void>}
   */
  return async function (authURL) {
    /** @type {{ id: string; delta: AgentToolCallDelta }} */
    const data = {
      id: stepId,
      delta: {
        type: StepTypes.TOOL_CALLS,
        tool_calls: [{ ...toolCall, args: '' }],
        auth: authURL,
        expires_at: Date.now() + Time.TWO_MINUTES,
      },
    };
    const eventData = { event: GraphEvents.ON_RUN_STEP_DELTA, data };
    if (streamId) {
      await GenerationJobManager.emitChunk(streamId, eventData);
    } else {
      sendEvent(res, eventData);
    }
  };
}

/**
 * @param {object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {string} params.runId - The Run ID, i.e. message ID
 * @param {string} params.stepId - The ID of the step in the flow.
 * @param {ToolCallChunk} params.toolCall - The tool call object containing tool information.
 * @param {number} [params.index]
 * @param {string | null} [params.streamId] - The stream ID for resumable mode.
 * @returns {() => Promise<void>}
 */
function createRunStepEmitter({ res, runId, stepId, toolCall, index, streamId = null }) {
  return async function () {
    /** @type {import('@librechat/agents').RunStep} */
    const data = {
      runId: runId ?? Constants.USE_PRELIM_RESPONSE_MESSAGE_ID,
      id: stepId,
      type: StepTypes.TOOL_CALLS,
      index: index ?? 0,
      stepDetails: {
        type: StepTypes.TOOL_CALLS,
        tool_calls: [toolCall],
      },
    };
    const eventData = { event: GraphEvents.ON_RUN_STEP, data };
    if (streamId) {
      await GenerationJobManager.emitChunk(streamId, eventData);
    } else {
      sendEvent(res, eventData);
    }
  };
}

/**
 * Creates a function used to ensure the flow handler is only invoked once
 * @param {object} params
 * @param {string} params.flowId - The ID of the login flow.
 * @param {FlowStateManager<any>} params.flowManager - The flow manager instance.
 * @param {(authURL: string) => void} [params.callback]
 */
function createOAuthStart({ flowId, flowManager, callback }) {
  /**
   * Creates a function to handle OAuth login requests.
   * @param {string} authURL - The URL to redirect the user for OAuth authentication.
   * @returns {Promise<boolean>} Returns true to indicate the event was sent successfully.
   */
  return async function (authURL) {
    await flowManager.createFlowWithHandler(flowId, 'oauth_login', async () => {
      callback?.(authURL);
      logger.debug('Sent OAuth login request to client');
      return true;
    });
  };
}

/**
 * @param {object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {string} params.stepId - The ID of the step in the flow.
 * @param {ToolCallChunk} params.toolCall - The tool call object containing tool information.
 * @param {string | null} [params.streamId] - The stream ID for resumable mode.
 */
function createOAuthEnd({ res, stepId, toolCall, streamId = null }) {
  return async function () {
    /** @type {{ id: string; delta: AgentToolCallDelta }} */
    const data = {
      id: stepId,
      delta: {
        type: StepTypes.TOOL_CALLS,
        tool_calls: [{ ...toolCall }],
      },
    };
    const eventData = { event: GraphEvents.ON_RUN_STEP_DELTA, data };
    if (streamId) {
      await GenerationJobManager.emitChunk(streamId, eventData);
    } else {
      sendEvent(res, eventData);
    }
    logger.debug('Sent OAuth login success to client');
  };
}

/**
 * @param {object} params
 * @param {string} params.userId - The ID of the user.
 * @param {string} params.serverName - The name of the server.
 * @param {string} params.toolName - The name of the tool.
 * @param {FlowStateManager<any>} params.flowManager - The flow manager instance.
 */
function createAbortHandler({ userId, serverName, toolName, flowManager }) {
  return function () {
    logger.info(`[MCP][User: ${userId}][${serverName}][${toolName}] Tool call aborted`);
    const flowId = MCPOAuthHandler.generateFlowId(userId, serverName);
    // Clean up both mcp_oauth and mcp_get_tokens flows
    flowManager.failFlow(flowId, 'mcp_oauth', new Error('Tool call aborted'));
    flowManager.failFlow(flowId, 'mcp_get_tokens', new Error('Tool call aborted'));
  };
}

/**
 * @param {Object} params
 * @param {() => void} params.runStepEmitter
 * @param {(authURL: string) => void} params.runStepDeltaEmitter
 * @returns {(authURL: string) => void}
 */
function createOAuthCallback({ runStepEmitter, runStepDeltaEmitter }) {
  return function (authURL) {
    runStepEmitter();
    runStepDeltaEmitter(authURL);
  };
}

/**
 * @param {Object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {IUser} params.user - The user from the request object.
 * @param {string} params.serverName
 * @param {AbortSignal} params.signal
 * @param {string} params.model
 * @param {number} [params.index]
 * @param {string | null} [params.streamId] - The stream ID for resumable mode.
 * @param {Record<string, Record<string, string>>} [params.userMCPAuthMap]
 * @returns { Promise<Array<typeof tool | { _call: (toolInput: Object | string) => unknown}>> } An object with `_call` method to execute the tool input.
 */
async function reconnectServer({
  res,
  user,
  index,
  signal,
  serverName,
  userMCPAuthMap,
  streamId = null,
}) {
  logger.debug(
    `[MCP][reconnectServer] serverName: ${serverName}, user: ${user?.id}, hasUserMCPAuthMap: ${!!userMCPAuthMap}`,
  );
  const runId = Constants.USE_PRELIM_RESPONSE_MESSAGE_ID;
  const flowId = `${user.id}:${serverName}:${Date.now()}`;
  const flowManager = getFlowStateManager(getLogStores(CacheKeys.FLOWS));
  const stepId = 'step_oauth_login_' + serverName;
  const toolCall = {
    id: flowId,
    name: serverName,
    type: 'tool_call_chunk',
  };

  // Set up abort handler to clean up OAuth flows if request is aborted
  const oauthFlowId = MCPOAuthHandler.generateFlowId(user.id, serverName);
  const abortHandler = () => {
    logger.info(
      `[MCP][User: ${user.id}][${serverName}] Tool loading aborted, cleaning up OAuth flows`,
    );
    // Clean up both mcp_oauth and mcp_get_tokens flows
    flowManager.failFlow(oauthFlowId, 'mcp_oauth', new Error('Tool loading aborted'));
    flowManager.failFlow(oauthFlowId, 'mcp_get_tokens', new Error('Tool loading aborted'));
  };

  if (signal) {
    signal.addEventListener('abort', abortHandler, { once: true });
  }

  try {
    const runStepEmitter = createRunStepEmitter({
      res,
      index,
      runId,
      stepId,
      toolCall,
      streamId,
    });
    const runStepDeltaEmitter = createRunStepDeltaEmitter({
      res,
      stepId,
      toolCall,
      streamId,
    });
    const callback = createOAuthCallback({ runStepEmitter, runStepDeltaEmitter });
    const oauthStart = createOAuthStart({
      res,
      flowId,
      callback,
      flowManager,
    });
    return await reinitMCPServer({
      user,
      signal,
      serverName,
      oauthStart,
      flowManager,
      userMCPAuthMap,
      forceNew: true,
      returnOnOAuth: false,
      connectionTimeout: Time.TWO_MINUTES,
    });
  } finally {
    // Clean up abort handler to prevent memory leaks
    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

/**
 * Creates all tools from the specified MCP Server via `toolKey`.
 *
 * This function assumes tools could not be aggregated from the cache of tool definitions,
 * i.e. `availableTools`, and will reinitialize the MCP server to ensure all tools are generated.
 *
 * @param {Object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {IUser} params.user - The user from the request object.
 * @param {string} params.serverName
 * @param {string} params.model
 * @param {Providers | EModelEndpoint} params.provider - The provider for the tool.
 * @param {number} [params.index]
 * @param {AbortSignal} [params.signal]
 * @param {string | null} [params.streamId] - The stream ID for resumable mode.
 * @param {import('@librechat/api').ParsedServerConfig} [params.config]
 * @param {Record<string, Record<string, string>>} [params.userMCPAuthMap]
 * @returns { Promise<Array<typeof tool | { _call: (toolInput: Object | string) => unknown}>> } An object with `_call` method to execute the tool input.
 */

/**
 * Get the ID of the admin user for executing MCP tools
 * All MCP tool execution happens through the admin's MCP manager
 * Tries to use ADMIN_EMAIL from environment, falls back to first ADMIN user
 * @returns {Promise<string>} Admin user ID
 * @throws {Error} If no admin user is found
 */
async function getAdminId() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    let admin;

    // First, try to find admin by ADMIN_EMAIL if defined
    if (adminEmail) {
      admin = await User.findOne({ email: adminEmail }, '_id').lean().exec();
      if (admin) {
        logger.info(`[MCP ADMIN] Admin user resolved by ADMIN_EMAIL: ${adminEmail}`);
        return admin._id.toString();
      }
      logger.warn(`[MCP ADMIN] Admin user not found for ADMIN_EMAIL: ${adminEmail}, falling back to role-based lookup`);
    }

    // Fallback: find first user with ADMIN role
    admin = await User.findOne({ role: SystemRoles.ADMIN }, '_id').lean().exec();
    if (!admin) {
      throw new Error('Admin user not found by ADMIN_EMAIL or ADMIN role');
    }
    logger.info(`[MCP ADMIN] Admin user resolved by role: ${admin._id.toString()}`);
    return admin._id.toString();
  } catch (error) {
    logger.error('[MCP] Error getting admin ID:', error);
    throw error;
  }
}

/**
 * Get MCP server config for a user, with fallback to admin-created servers
 * @param {string} serverName - The MCP server name
 * @param {string} userId - The current user's ID
 * @returns {Promise<Object|null>} Server config object or null if not found
 */
async function getServerConfigWithAdminFallback(serverName, userId) {
  try {
    // First, try to get user's own server config
    let serverConfig = await getMCPServersRegistry().getServerConfig(serverName, userId);

    if (serverConfig) {
      logger.info(`[MCP] Found user server config for ${serverName} (userId=${userId})`);
      logger.info(`[MCP CONFIG] server=${serverName} ownerId=${userId}`);
      return { ...serverConfig, userId };
    }

    logger.info(`[MCP] User config not found for ${serverName}, checking admin configs...`);

    // If not found, fallback to admin servers
    const admins = await User.find({ role: SystemRoles.ADMIN }, '_id').lean().exec();

    if (!admins || admins.length === 0) {
      logger.warn(`[MCP] No admin server config found for ${serverName}`);
      return null;
    }

    // Try each admin's server config
    for (const admin of admins) {
      serverConfig = await getMCPServersRegistry().getServerConfig(serverName, admin._id.toString());
      if (serverConfig) {
        const adminId = admin._id.toString();
        logger.info(`[MCP] Found admin server config for ${serverName} (adminId=${adminId})`);
        logger.info(`[MCP CONFIG] server=${serverName} ownerId=${adminId}`);
        return { ...serverConfig, userId: adminId };
      }
    }

    logger.warn(`[MCP] No server config found for ${serverName} in any admin account`);
    return null;
  } catch (error) {
    logger.error(`[MCP] Error getting server config for ${serverName}:`, error);
    return null;
  }
}

async function createMCPTools({
  res,
  user,
  index,
  signal,
  config,
  provider,
  serverName,
  userMCPAuthMap,
  streamId = null,
}) {
  logger.info(`[MCP AUDIT] Step 2 - Building tools for serverName=${serverName}, userId=${user?.id}`);

  // Early domain validation before reconnecting server (avoid wasted work on disallowed domains)
  // Use getAppConfig() to support per-user/role domain restrictions
  const serverConfig =
    config ?? (await getServerConfigWithAdminFallback(serverName, user?.id));

  logger.info(`[MCP AUDIT] serverConfig found for ${serverName}: ${!!serverConfig}`);

  if (serverConfig?.url) {
    const appConfig = await getAppConfig({ role: user?.role });
    const allowedDomains = appConfig?.mcpSettings?.allowedDomains;
    const isDomainAllowed = await isMCPDomainAllowed(serverConfig, allowedDomains);
    if (!isDomainAllowed) {
      logger.warn(`[MCP][${serverName}] Domain not allowed, skipping all tools`);
      return [];
    }
  }

  const result = await reconnectServer({
    res,
    user,
    index,
    signal,
    serverName,
    userMCPAuthMap,
    streamId,
  });
  if (!result || !result.tools) {
    logger.warn(`[MCP][${serverName}] Failed to reinitialize MCP server.`);
    return;
  }

  const serverTools = [];
  for (const tool of result.tools) {
    const toolInstance = await createMCPTool({
      res,
      user,
      provider,
      userMCPAuthMap,
      streamId,
      availableTools: result.availableTools,
      toolKey: `${tool.name}${Constants.mcp_delimiter}${serverName}`,
      config: serverConfig,
    });
    if (toolInstance) {
      serverTools.push(toolInstance);
    }
  }

  return serverTools;
}

/**
 * Creates a single tool from the specified MCP Server via `toolKey`.
 * @param {Object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {IUser} params.user - The user from the request object.
 * @param {string} params.toolKey - The toolKey for the tool.
 * @param {string} params.model - The model for the tool.
 * @param {number} [params.index]
 * @param {AbortSignal} [params.signal]
 * @param {string | null} [params.streamId] - The stream ID for resumable mode.
 * @param {Providers | EModelEndpoint} params.provider - The provider for the tool.
 * @param {LCAvailableTools} [params.availableTools]
 * @param {Record<string, Record<string, string>>} [params.userMCPAuthMap]
 * @param {import('@librechat/api').ParsedServerConfig} [params.config]
 * @returns { Promise<typeof tool | { _call: (toolInput: Object | string) => unknown}> } An object with `_call` method to execute the tool input.
 */
async function createMCPTool({
  res,
  user,
  index,
  signal,
  toolKey,
  provider,
  userMCPAuthMap,
  availableTools,
  config,
  streamId = null,
}) {
  // toolKey format: tavily_search_mcp_tavily (tool_mcp_server)
  const [toolNamePart, serverName] = toolKey.split('_mcp_');

  logger.info(
    `[MCP DIAG] Parsed MCP tool: tool=${toolNamePart} server=${serverName}`
  );

  // For logging, we use the full toolKey as the tool identifier
  const toolName = toolKey;

  logger.info(`[MCP DIAG] Creating tool - full name: ${toolName}, server: ${serverName}`);

  // Runtime domain validation: check if the server's domain is still allowed
  // Use getAppConfig() to support per-user/role domain restrictions
  const serverConfig =
    config ?? (await getServerConfigWithAdminFallback(serverName, user?.id));
  if (serverConfig?.url) {
    const appConfig = await getAppConfig({ role: user?.role });
    const allowedDomains = appConfig?.mcpSettings?.allowedDomains;
    const isDomainAllowed = await isMCPDomainAllowed(serverConfig, allowedDomains);
    if (!isDomainAllowed) {
      logger.warn(`[MCP][${serverName}] Domain no longer allowed, skipping tool: ${toolName}`);
      return undefined;
    }
  }

  logger.info(`[MCP DIAG] Available tools keys: ${Object.keys(availableTools || {}).join(', ')}`);
  logger.info(`[MCP DIAG] Looking for toolKey: ${toolKey}`);

  /** @type {LCTool | undefined} */
  let toolDefinition = availableTools?.[toolKey]?.function;
  if (!toolDefinition) {
    logger.warn(
      `[MCP][${serverName}][${toolName}] Requested tool not found in available tools, re-initializing MCP server.`,
    );
    const result = await reconnectServer({
      res,
      user,
      index,
      signal,
      serverName,
      userMCPAuthMap,
      streamId,
    });
    toolDefinition = result?.availableTools?.[toolKey]?.function;
  }

  if (!toolDefinition) {
    logger.warn(`[MCP][${serverName}][${toolName}] Tool definition not found, cannot create tool.`);
    return;
  }

  // Normalize MCP toolDefinition if it doesn't have the 'function' wrapper
  if (toolDefinition && !toolDefinition.function && toolDefinition.name) {
    logger.info(`[MCP DIAG] Normalizing MCP toolDefinition for ${toolDefinition.name}`);
    toolDefinition = {
      type: 'function',
      function: {
        name: toolDefinition.name,
        description: toolDefinition.description || '',
        parameters: toolDefinition.input_schema || {
          type: 'object',
          properties: {},
        },
      },
    };
    logger.info(
      `[MCP DIAG] Normalized MCP toolDefinition for ${toolDefinition.function.name}`
    );
  }

  return createToolInstance({
    res,
    provider,
    toolName,
    serverName,
    toolDefinition: toolDefinition.function,
    streamId,
  });
}

function createToolInstance({
  res,
  toolName,
  serverName,
  toolDefinition,
  provider: _provider,
  streamId = null,
}) {
  /** @type {LCTool} */
  const { description, parameters } = toolDefinition;
  const isGoogle = _provider === Providers.VERTEXAI || _provider === Providers.GOOGLE;

  let schema = parameters ? normalizeJsonSchema(resolveJsonSchemaRefs(parameters)) : null;

  if (!schema || (isGoogle && isEmptyObjectSchema(schema))) {
    schema = {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input for the tool' },
      },
      required: [],
    };
  }

  // Use the full tool name (toolName) which already includes the mcp suffix
  // Do not re-construct it with server name
  const normalizedToolKey = toolName;

  /** @type {(toolArguments: Object | string, config?: GraphRunnableConfig) => Promise<unknown>} */
  const _call = async (toolArguments, config) => {
    const userId = config?.configurable?.user?.id || config?.configurable?.user_id;
    /** @type {ReturnType<typeof createAbortHandler>} */
    let abortHandler = null;
    /** @type {AbortSignal} */
    let derivedSignal = null;

    try {
      const flowsCache = getLogStores(CacheKeys.FLOWS);
      const flowManager = getFlowStateManager(flowsCache);
      derivedSignal = config?.signal ? AbortSignal.any([config.signal]) : undefined;

      // ДИАГНОСТИКА: ШАГ 4 - Tool Execution
      logger.info(`[MCP DIAG] ===== Tool execution requested: ${normalizedToolKey}`);
      logger.info(`[MCP DIAG] Tool name in registry: ${normalizedToolKey}`);
      logger.info(`[MCP DIAG] userId: ${userId}, toolArguments: ${JSON.stringify(toolArguments).substring(0, 100)}`);

      // Verify server config exists
      const execServerConfig = serverConfig ?? (await getServerConfigWithAdminFallback(serverName, userId));

      if (!execServerConfig) {
        logger.error(`[MCP EXECUTION] CRITICAL: No server config found for ${serverName} (userId=${userId})`);
        logger.error(`[MCP DIAG] Server config lookup failed for ${serverName}`);
        throw new Error(`Configuration for server "${serverName}" not found`);
      }

      logger.info(`[MCP DIAG] Server config found for ${serverName}`);

      // All MCP tools execute through admin's MCP manager
      const adminId = await getAdminId();
      logger.info(`[MCP DIAG] Admin ID resolved: ${adminId}`);

      logger.info(`[MCP EXECUTION] user=${userId} executed via admin MCP for tool=${serverName}.${toolName}`);
      logger.info(`[MCP DIAG] MCPManager will be created for adminId: ${adminId}`);

      const mcpManager = getMCPManager(adminId);
      logger.info(`[MCP DIAG] MCPManager created successfully`);
      const provider = (config?.metadata?.provider || _provider)?.toLowerCase();

      const { args: _args, stepId, ...toolCall } = config.toolCall ?? {};
      const flowId = `${serverName}:oauth_login:${config.metadata.thread_id}:${config.metadata.run_id}`;
      const runStepDeltaEmitter = createRunStepDeltaEmitter({
        res,
        stepId,
        toolCall,
        streamId,
      });
      const oauthStart = createOAuthStart({
        flowId,
        flowManager,
        callback: runStepDeltaEmitter,
      });
      const oauthEnd = createOAuthEnd({
        res,
        stepId,
        toolCall,
        streamId,
      });

      if (derivedSignal) {
        abortHandler = createAbortHandler({ userId, serverName, toolName, flowManager });
        derivedSignal.addEventListener('abort', abortHandler, { once: true });
      }

      const customUserVars =
        config?.configurable?.userMCPAuthMap?.[`${Constants.mcp_prefix}${serverName}`];

      const result = await mcpManager.callTool({
        serverName,
        toolName,
        provider,
        ownerId: adminId,
        toolArguments,
        options: {
          signal: derivedSignal,
        },
        user: config?.configurable?.user,
        requestBody: config?.configurable?.requestBody,
        customUserVars,
        flowManager,
        tokenMethods: {
          findToken,
          createToken,
          updateToken,
        },
        oauthStart,
        oauthEnd,
        graphTokenResolver: getGraphApiToken,
      });

      if (isAssistantsEndpoint(provider) && Array.isArray(result)) {
        return result[0];
      }
      if (isGoogle && Array.isArray(result[0]) && result[0][0]?.type === ContentTypes.TEXT) {
        return [result[0][0].text, result[1]];
      }
      return result;
    } catch (error) {
      logger.error(
        `[MCP][${serverName}][${toolName}][User: ${userId}] Error calling MCP tool:`,
        error,
      );

      /** OAuth error, provide a helpful message */
      const isOAuthError =
        error.message?.includes('401') ||
        error.message?.includes('OAuth') ||
        error.message?.includes('authentication') ||
        error.message?.includes('Non-200 status code (401)');

      if (isOAuthError) {
        throw new Error(
          `[MCP][${serverName}][${toolName}] OAuth authentication required. Please check the server logs for the authentication URL.`,
        );
      }

      throw new Error(
        `[MCP][${serverName}][${toolName}] tool call failed${error?.message ? `: ${error?.message}` : '.'}`,
      );
    } finally {
      // Clean up abort handler to prevent memory leaks
      if (abortHandler && derivedSignal) {
        derivedSignal.removeEventListener('abort', abortHandler);
      }
    }
  };

  const toolInstance = tool(_call, {
    schema,
    name: normalizedToolKey,
    description: description || '',
    responseFormat: AgentConstants.CONTENT_AND_ARTIFACT,
  });

  logger.info(`[MCP DIAG] Tool instance created - function.name: ${toolInstance.function.name}`);

  toolInstance.mcp = true;
  toolInstance.mcpRawServerName = serverName;
  toolInstance.mcpJsonSchema = parameters;
  return toolInstance;
}

/**
 * Get MCP servers for a user, including their own and all admin-created servers
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Combined MCP server configurations
 */
async function getMCPServersWithAdmins(userId) {
  try {
    // Get user's own MCP servers
    const userConfigs = await getMCPServersRegistry().getAllServerConfigs(userId);

    // Get all admin users
    const admins = await User.find({ role: SystemRoles.ADMIN }, '_id').lean().exec();

    if (!admins || admins.length === 0) {
      return userConfigs;
    }

    // Get MCP servers from all admins
    const adminConfigs = {};
    for (const admin of admins) {
      const configs = await getMCPServersRegistry().getAllServerConfigs(admin._id.toString());
      if (configs) {
        Object.assign(adminConfigs, configs);
      }
    }

    // Merge: admin servers first, then user servers (user servers can override)
    return { ...adminConfigs, ...userConfigs };
  } catch (error) {
    logger.error('[getMCPServersWithAdmins] Error getting admin MCP servers:', error);
    // Fallback to user's own servers if admin lookup fails
    return await getMCPServersRegistry().getAllServerConfigs(userId);
  }
}

/**
 * Get MCP setup data including config, connections, and OAuth servers
 * @param {string} userId - The user ID
 * @returns {Object} Object containing mcpConfig, appConnections, userConnections, and oauthServers
 */
async function getMCPSetupData(userId) {
  const mcpConfig = await getMCPServersWithAdmins(userId);

  logger.info(`[MCP AUDIT] Step 1 - MCP Servers Loaded for userId=${userId}`);
  logger.info(`[MCP AUDIT] MCP servers available: ${Object.keys(mcpConfig || {}).join(', ')}`);
  logger.info(`[MCP AUDIT] Total servers: ${Object.keys(mcpConfig || {}).length}`);

  if (!mcpConfig) {
    throw new Error('MCP config not found');
  }

  // Use admin's MCP manager for all server connections
  const adminId = await getAdminId();
  const mcpManager = getMCPManager(adminId);
  /** @type {Map<string, import('@librechat/api').MCPConnection>} */
  let appConnections = new Map();
  try {
    // Use getLoaded() instead of getAll() to avoid forcing connection creation
    // getAll() creates connections for all servers, which is problematic for servers
    // that require user context (e.g., those with {{LIBRECHAT_USER_ID}} placeholders)
    appConnections = (await mcpManager.appConnections?.getLoaded()) || new Map();
  } catch (error) {
    logger.error(`[MCP][User: ${userId}] Error getting app connections:`, error);
  }
  const userConnections = mcpManager.getUserConnections(userId) || new Map();
  const oauthServers = await getMCPServersRegistry().getOAuthServers(userId);

  return {
    mcpConfig,
    oauthServers,
    appConnections,
    userConnections,
  };
}

/**
 * Check OAuth flow status for a user and server
 * @param {string} userId - The user ID
 * @param {string} serverName - The server name
 * @returns {Object} Object containing hasActiveFlow and hasFailedFlow flags
 */
async function checkOAuthFlowStatus(userId, serverName) {
  const flowsCache = getLogStores(CacheKeys.FLOWS);
  const flowManager = getFlowStateManager(flowsCache);
  const flowId = MCPOAuthHandler.generateFlowId(userId, serverName);

  try {
    const flowState = await flowManager.getFlowState(flowId, 'mcp_oauth');
    if (!flowState) {
      return { hasActiveFlow: false, hasFailedFlow: false };
    }

    const flowAge = Date.now() - flowState.createdAt;
    const flowTTL = flowState.ttl || 180000; // Default 3 minutes

    if (flowState.status === 'FAILED' || flowAge > flowTTL) {
      const wasCancelled = flowState.error && flowState.error.includes('cancelled');

      if (wasCancelled) {
        logger.debug(`[MCP Connection Status] Found cancelled OAuth flow for ${serverName}`, {
          flowId,
          status: flowState.status,
          error: flowState.error,
        });
        return { hasActiveFlow: false, hasFailedFlow: false };
      } else {
        logger.debug(`[MCP Connection Status] Found failed OAuth flow for ${serverName}`, {
          flowId,
          status: flowState.status,
          flowAge,
          flowTTL,
          timedOut: flowAge > flowTTL,
          error: flowState.error,
        });
        return { hasActiveFlow: false, hasFailedFlow: true };
      }
    }

    if (flowState.status === 'PENDING') {
      logger.debug(`[MCP Connection Status] Found active OAuth flow for ${serverName}`, {
        flowId,
        flowAge,
        flowTTL,
      });
      return { hasActiveFlow: true, hasFailedFlow: false };
    }

    return { hasActiveFlow: false, hasFailedFlow: false };
  } catch (error) {
    logger.error(`[MCP Connection Status] Error checking OAuth flows for ${serverName}:`, error);
    return { hasActiveFlow: false, hasFailedFlow: false };
  }
}

/**
 * Get connection status for a specific MCP server
 * @param {string} userId - The user ID
 * @param {string} serverName - The server name
 * @param {import('@librechat/api').ParsedServerConfig} config - The server configuration
 * @param {Map<string, import('@librechat/api').MCPConnection>} appConnections - App-level connections
 * @param {Map<string, import('@librechat/api').MCPConnection>} userConnections - User-level connections
 * @param {Set} oauthServers - Set of OAuth servers
 * @returns {Object} Object containing requiresOAuth and connectionState
 */
async function getServerConnectionStatus(
  userId,
  serverName,
  config,
  appConnections,
  userConnections,
  oauthServers,
) {
  const connection = appConnections.get(serverName) || userConnections.get(serverName);
  const isStaleOrDoNotExist = connection ? connection?.isStale(config.updatedAt) : true;

  const baseConnectionState = isStaleOrDoNotExist
    ? 'disconnected'
    : connection?.connectionState || 'disconnected';
  let finalConnectionState = baseConnectionState;

  // connection state overrides specific to OAuth servers
  if (baseConnectionState === 'disconnected' && oauthServers.has(serverName)) {
    // check if server is actively being reconnected
    const oauthReconnectionManager = getOAuthReconnectionManager();
    if (oauthReconnectionManager.isReconnecting(userId, serverName)) {
      finalConnectionState = 'connecting';
    } else {
      const { hasActiveFlow, hasFailedFlow } = await checkOAuthFlowStatus(userId, serverName);

      if (hasFailedFlow) {
        finalConnectionState = 'error';
      } else if (hasActiveFlow) {
        finalConnectionState = 'connecting';
      }
    }
  }

  return {
    requiresOAuth: oauthServers.has(serverName),
    connectionState: finalConnectionState,
  };
}

module.exports = {
  createMCPTool,
  createMCPTools,
  getAdminId,
  reinitMCPServer,
  getMCPSetupData,
  getMCPServersWithAdmins,
  getServerConfigWithAdminFallback,
  checkOAuthFlowStatus,
  getServerConnectionStatus,
};
