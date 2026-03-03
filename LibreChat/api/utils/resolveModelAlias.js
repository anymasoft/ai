/**
 * Resolves model alias to actual model ID in registry
 * 
 * Handles the case where UI/Admin use short alias (e.g., "claude-haiku-4-5")
 * but registry contains versioned IDs (e.g., "claude-haiku-4-5-20251001")
 * 
 * @param {string} endpoint - The endpoint name (e.g., 'anthropic')
 * @param {string} model - The requested model (alias or exact ID)
 * @param {string[]} availableModels - List of available models in registry
 * @returns {string|null} - Resolved model ID or null if not found
 */
function resolveModelAlias(endpoint, model, availableModels) {
  if (!model || !availableModels || availableModels.length === 0) {
    return null;
  }

  // ✅ Step 1: Exact match - model already in registry
  if (availableModels.includes(model)) {
    return model;
  }

  // ✅ Step 2: Alias resolution - find versioned variants
  // For example: "claude-haiku-4-5" → "claude-haiku-4-5-20251001"
  const aliasPrefix = model + '-';
  const matchingModels = availableModels.filter(
    (available) => available.startsWith(aliasPrefix)
  );

  if (matchingModels.length === 0) {
    // ❌ No match found
    return null;
  }

  if (matchingModels.length === 1) {
    // ✅ Exactly one match
    return matchingModels[0];
  }

  // ✅ Step 3: Multiple matches - select latest by suffix (YYYYMMDD format)
  // Sort in descending order to get the newest version
  const sorted = [...matchingModels].sort().reverse();
  return sorted[0];
}

module.exports = resolveModelAlias;
