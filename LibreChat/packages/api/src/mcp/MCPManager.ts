import pick from 'lodash/pick';
import { logger } from '@librechat/data-schemas';
import { CallToolResultSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { TokenMethods, IUser } from '@librechat/data-schemas';
import type { GraphTokenResolver } from '~/utils/graph';
import type { FlowStateManager } from '~/flow/manager';
import type { MCPOAuthTokens } from './oauth';
import type { RequestBody } from '~/types';
import type * as t from './types';
import { MCPServersInitializer } from './registry/MCPServersInitializer';
import { MCPServerInspector } from './registry/MCPServerInspector';
import { MCPServersRegistry } from './registry/MCPServersRegistry';
import { UserConnectionManager } from './UserConnectionManager';
import { ConnectionsRepository } from './ConnectionsRepository';
import { MCPConnectionFactory } from './MCPConnectionFactory';
import { preProcessGraphTokens } from '~/utils/graph';
import { formatToolContent } from './parsers';
import { MCPConnection } from './connection';
import { processMCPEnv } from '~/utils/env';

/**
 * Centralized manager for MCP server connections and tool execution.
 * Extends UserConnectionManager to handle both app-level and user-specific connections.
 */
export class MCPManager extends UserConnectionManager {
  private static instance: MCPManager | null;
  private adminId: string | null = null;

  /** Creates and initializes the singleton MCPManager instance */
  public static async createInstance(configs: t.MCPServers, adminId?: string): Promise<MCPManager> {
    if (MCPManager.instance) throw new Error('MCPManager has already been initialized.');
    MCPManager.instance = new MCPManager();
    if (adminId) {
      MCPManager.instance.adminId = adminId;
    }
    await MCPManager.instance.initialize(configs);
    return MCPManager.instance;
  }

  /** Returns the singleton MCPManager instance */
  public static getInstance(): MCPManager {
    if (!MCPManager.instance) throw new Error('MCPManager has not been initialized.');
    return MCPManager.instance;
  }

  /** Initializes the MCPManager by setting up server registry and app connections */
  public async initialize(configs: t.MCPServers) {
    await MCPServersInitializer.initialize(configs);
    this.appConnections = new ConnectionsRepository(undefined);
  }

  /** Retrieves an app-level connection. For MVP, all connections use admin credentials. */
  public async getConnection(
    args: {
      serverName: string;
      forceNew?: boolean;
      flowManager?: FlowStateManager<MCPOAuthTokens | null>;
    } & Omit<t.OAuthConnectionOptions, 'useOAuth' | 'user' | 'flowManager'>,
  ): Promise<MCPConnection> {
    if (!this.adminId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `MVP: Admin ID not set. Cannot establish MCP connection.`,
      );
    }

    // Always use app-level connections for MVP architecture
    const existingAppConnection = await this.appConnections!.get(args.serverName);
    if (existingAppConnection) {
      return existingAppConnection;
    }

    throw new McpError(
      ErrorCode.InvalidRequest,
      `[MCP MVP] App connection not found for server ${args.serverName}. Only admin-configured servers are available.`,
    );
  }

  /**
   * Discovers tools from an MCP server using admin credentials.
   * For MVP: All tool discovery uses admin configuration.
   */
  public async discoverServerTools(args: t.ToolDiscoveryOptions): Promise<t.ToolDiscoveryResult> {
    if (!this.adminId) {
      throw new Error('[MCP MVP] Admin ID not initialized. Cannot discover tools.');
    }

    const { serverName, user, flowManager } = args;
    const logPrefix = `[MCP MVP][Admin: ${this.adminId}][${serverName}]`;

    logger.info(`${logPrefix} Discovering tools (user requesting: ${user?.id || 'anonymous'})`);

    try {
      // Try app-level connection first
      const existingAppConnection = await this.appConnections?.get(serverName);
      if (existingAppConnection && (await existingAppConnection.isConnected())) {
        const tools = await existingAppConnection.fetchTools();
        return { tools, oauthRequired: false, oauthUrl: null };
      }
    } catch {
      logger.debug(`${logPrefix} App connection not available`);
    }

    // Get admin config
    const serverConfig = (await MCPServersRegistry.getInstance().getServerConfig(
      serverName,
      this.adminId,
    )) as t.MCPOptions | null;

    if (!serverConfig) {
      logger.warn(`${logPrefix} Server config not found (admin has no config for this server)`);
      return { tools: null, oauthRequired: false, oauthUrl: null };
    }

    const useOAuth = Boolean(
      serverConfig.requiresOAuth || (serverConfig as t.ParsedServerConfig).oauthMetadata,
    );

    const useSSRFProtection = MCPServersRegistry.getInstance().shouldEnableSSRFProtection();
    const basic: t.BasicConnectionOptions = { serverName, serverConfig, useSSRFProtection };

    if (!useOAuth) {
      const result = await MCPConnectionFactory.discoverTools(basic);
      return {
        tools: result.tools,
        oauthRequired: result.oauthRequired,
        oauthUrl: result.oauthUrl,
      };
    }

    // OAuth discovery - use admin for authentication
    if (!flowManager) {
      logger.warn(`${logPrefix} OAuth required but no flowManager provided`);
      return { tools: null, oauthRequired: true, oauthUrl: null };
    }

    const result = await MCPConnectionFactory.discoverTools(basic, {
      user: { id: this.adminId } as IUser,
      useOAuth: true,
      flowManager,
      tokenMethods: args.tokenMethods,
      signal: args.signal,
      oauthStart: args.oauthStart,
      customUserVars: args.customUserVars,
      requestBody: args.requestBody,
      connectionTimeout: args.connectionTimeout,
    });

    return { tools: result.tools, oauthRequired: result.oauthRequired, oauthUrl: result.oauthUrl };
  }

  /** Returns all available tool functions from app-level connections */
  public async getAppToolFunctions(): Promise<t.LCAvailableTools> {
    const toolFunctions: t.LCAvailableTools = {};
    const configs = await MCPServersRegistry.getInstance().getAllServerConfigs();
    for (const config of Object.values(configs)) {
      if (config.toolFunctions != null) {
        Object.assign(toolFunctions, config.toolFunctions);
      }
    }
    return toolFunctions;
  }

  /** Returns tool functions from admin app-level connection. For MVP, only admin connections are available. */
  public async getServerToolFunctions(
    userId: string,
    serverName: string,
  ): Promise<t.LCAvailableTools | null> {
    try {
      // MVP: Only use app-level admin connections
      const existingAppConnection = await this.appConnections?.get(serverName);
      if (existingAppConnection) {
        logger.debug(
          `[MCP MVP] getServerToolFunctions for user=${userId} using admin app connection for server=${serverName}`,
        );
        return MCPServerInspector.getToolFunctions(serverName, existingAppConnection);
      }

      logger.warn(
        `[MCP MVP] getServerToolFunctions: No admin app connection for server=${serverName}`,
      );
      return null;
    } catch (error) {
      logger.warn(
        `[MCP MVP][getServerToolFunctions] Error getting tool functions for server ${serverName}`,
        error,
      );
      return null;
    }
  }

  /**
   * Get instructions for MCP servers
   * @param serverNames Optional array of server names. If not provided or empty, returns all servers.
   * @returns Object mapping server names to their instructions
   */
  private async getInstructions(serverNames?: string[]): Promise<Record<string, string>> {
    const instructions: Record<string, string> = {};
    const configs = await MCPServersRegistry.getInstance().getAllServerConfigs();
    for (const [serverName, config] of Object.entries(configs)) {
      if (config.serverInstructions != null) {
        instructions[serverName] = config.serverInstructions as string;
      }
    }
    if (!serverNames) return instructions;
    return pick(instructions, serverNames);
  }

  /**
   * Format MCP server instructions for injection into context
   * @param serverNames Optional array of server names to include. If not provided, includes all servers.
   * @returns Formatted instructions string ready for context injection
   */
  public async formatInstructionsForContext(serverNames?: string[]): Promise<string> {
    /** Instructions for specified servers or all stored instructions */
    const instructionsToInclude = await this.getInstructions(serverNames);

    if (Object.keys(instructionsToInclude).length === 0) {
      return '';
    }

    // Format instructions for context injection
    const formattedInstructions = Object.entries(instructionsToInclude)
      .map(([serverName, instructions]) => {
        return `## ${serverName} MCP Server Instructions

${instructions}`;
      })
      .join('\n\n');

    return `# MCP Server Instructions

The following MCP servers are available with their specific instructions:

${formattedInstructions}

Please follow these instructions when using tools from the respective MCP servers.`;
  }

  /**
   * Calls a tool on an MCP server using admin credentials.
   * For MVP: All tool execution uses admin configuration, regardless of who invoked it.
   *
   * @param user - The requesting user (for logging only, not for connection)
   * @param serverName - The MCP server name
   * @param toolName - The tool to execute
   * @param graphTokenResolver - Optional function to resolve Graph API tokens via OBO flow
   */
  async callTool({
    user,
    serverName,
    toolName,
    provider,
    toolArguments,
    options,
    tokenMethods,
    requestBody,
    flowManager,
    oauthStart,
    oauthEnd,
    customUserVars,
    graphTokenResolver,
  }: {
    user?: IUser;
    serverName: string;
    toolName: string;
    provider: t.Provider;
    toolArguments?: Record<string, unknown>;
    options?: RequestOptions;
    requestBody?: RequestBody;
    tokenMethods?: TokenMethods;
    customUserVars?: Record<string, string>;
    flowManager: FlowStateManager<MCPOAuthTokens | null>;
    oauthStart?: (authURL: string) => Promise<void>;
    oauthEnd?: () => Promise<void>;
    graphTokenResolver?: GraphTokenResolver;
  }): Promise<t.FormattedToolResponse> {
    if (!this.adminId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `[MCP MVP] Admin ID not initialized. Cannot execute tool.`,
      );
    }

    const requestingUserId = user?.id || 'anonymous';
    const logPrefix = `[MCP MVP][Requesting: ${requestingUserId}][Admin: ${this.adminId}][${serverName}][${toolName}]`;

    logger.info(`${logPrefix} Executing tool...`);

    let connection: MCPConnection | undefined;

    try {
      // Get admin connection
      connection = await this.getConnection({
        serverName,
        flowManager,
        tokenMethods,
        oauthStart,
        oauthEnd,
        signal: options?.signal,
        customUserVars,
        requestBody,
      });

      if (!(await connection.isConnected())) {
        throw new McpError(
          ErrorCode.InternalError,
          `${logPrefix} Connection not active.`,
        );
      }

      // Get admin config
      const rawConfig = (await MCPServersRegistry.getInstance().getServerConfig(
        serverName,
        this.adminId,
      )) as t.MCPOptions;

      // Pre-process Graph tokens using admin context
      const graphProcessedConfig = await preProcessGraphTokens(rawConfig, {
        user: { id: this.adminId } as IUser,
        graphTokenResolver,
        scopes: process.env.GRAPH_API_SCOPES,
      });

      const currentOptions = processMCPEnv({
        user: { id: this.adminId } as IUser,
        options: graphProcessedConfig,
        customUserVars,
        body: requestBody,
      });

      if ('headers' in currentOptions) {
        connection.setRequestHeaders(currentOptions.headers || {});
      }

      const result = await connection.client.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: toolArguments,
          },
        },
        CallToolResultSchema,
        {
          timeout: connection.timeout,
          resetTimeoutOnProgress: true,
          ...options,
        },
      );

      this.checkIdleConnections();
      logger.info(`${logPrefix} Executed successfully`);
      return formatToolContent(result as t.MCPToolCallResponse, provider);
    } catch (error) {
      logger.error(`${logPrefix} Tool call failed`, error);
      throw error;
    }
  }
}
