const { EventSource } = require('eventsource');
const { Time } = require('librechat-data-provider');
const {
  MCPManager,
  FlowStateManager,
  MCPServersRegistry,
  OAuthReconnectionManager,
} = require('@librechat/api');
const logger = require('./winston');

global.EventSource = EventSource;

/** @type {MCPManager} */
let flowManager = null;

/** Admin ID resolved at startup */
let ADMIN_ID = null;

/**
 * Set ADMIN_ID from server initialization
 * @param {string} adminId
 */
function setAdminId(adminId) {
  ADMIN_ID = adminId;
}

/**
 * Get ADMIN_ID for MCP execution
 * @returns {string} Admin user ID
 */
function getAdminId() {
  if (!ADMIN_ID) {
    throw new Error('Admin ID not yet initialized. This should not happen if server started correctly.');
  }
  return ADMIN_ID;
}

/**
 * @param {Keyv} flowsCache
 * @returns {FlowStateManager}
 */
function getFlowStateManager(flowsCache) {
  if (!flowManager) {
    flowManager = new FlowStateManager(flowsCache, {
      ttl: Time.ONE_MINUTE * 3,
    });
  }
  return flowManager;
}

module.exports = {
  logger,
  createMCPServersRegistry: MCPServersRegistry.createInstance,
  getMCPServersRegistry: MCPServersRegistry.getInstance,
  createMCPManager: MCPManager.createInstance,
  getMCPManager: MCPManager.getInstance,
  getFlowStateManager,
  setAdminId,
  getAdminId,
  createOAuthReconnectionManager: OAuthReconnectionManager.createInstance,
  getOAuthReconnectionManager: OAuthReconnectionManager.getInstance,
};
