/**
 * UI Feature Flags
 * Control visibility of features in the interface without removing them from code
 * These can be toggled for MVP or later releases
 */

export const UI_FEATURES = {
  // MVP - only MCP servers are visible
  FILE_SEARCH: false,
  WEB_SEARCH: false,
  CODE_INTERPRETER: false,
  ARTIFACTS: false,

  // Keep MCP servers visible
  MCP_SERVERS: true,
} as const;
