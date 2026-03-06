const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const { loadDefaultModels, loadConfigModels } = require('~/server/services/Config');
const { getLogStores } = require('~/cache');

/**
 * @param {ServerRequest} req
 * @returns {Promise<TModelsConfig>} The models config.
 */
const getModelsConfig = async (req) => {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);
  let modelsConfig = await cache.get(CacheKeys.MODELS_CONFIG);
  if (!modelsConfig) {
    modelsConfig = await loadModels(req);
  }

  return modelsConfig;
};

/**
 * Loads the models from the config.
 * @param {ServerRequest} req - The Express request object.
 * @returns {Promise<TModelsConfig>} The models config.
 */
async function loadModels(req) {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);
  const cachedModelsConfig = await cache.get(CacheKeys.MODELS_CONFIG);
  if (cachedModelsConfig) {
    logger.debug('[ModelController.loadModels] Using cached models config', {
      endpoints: Object.keys(cachedModelsConfig),
      anthropicModels: cachedModelsConfig.anthropic?.length,
    });
    return cachedModelsConfig;
  }

  logger.debug('[ModelController.loadModels] Loading models from sources');
  const defaultModelsConfig = await loadDefaultModels(req);
  logger.debug('[ModelController.loadModels] Default models loaded', {
    endpoints: Object.keys(defaultModelsConfig),
    anthropicModels: defaultModelsConfig.anthropic?.slice(0, 5),
    anthropicCount: defaultModelsConfig.anthropic?.length,
  });

  const customModelsConfig = await loadConfigModels(req);
  logger.debug('[ModelController.loadModels] Custom models loaded', {
    endpoints: Object.keys(customModelsConfig),
    anthropicModels: customModelsConfig.anthropic?.slice(0, 5),
  });

  const modelConfig = { ...defaultModelsConfig, ...customModelsConfig };

  logger.debug('[ModelController.loadModels] Final merged config', {
    endpoints: Object.keys(modelConfig),
    anthropicModels: modelConfig.anthropic?.slice(0, 5),
    anthropicCount: modelConfig.anthropic?.length,
    hasHaiku: modelConfig.anthropic?.includes('claude-haiku-4-5'),
  });

  await cache.set(CacheKeys.MODELS_CONFIG, modelConfig);
  return modelConfig;
}

async function modelController(req, res) {
  try {
    const modelConfig = await loadModels(req);
    res.send(modelConfig);
  } catch (error) {
    logger.error('Error fetching models:', error);
    res.status(500).send({ error: error.message });
  }
}

module.exports = { modelController, loadModels, getModelsConfig };
