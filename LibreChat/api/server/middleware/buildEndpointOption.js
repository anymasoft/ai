const { handleError } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const {
  EndpointURLs,
  EModelEndpoint,
  isAgentsEndpoint,
  parseCompactConvo,
  getDefaultParamsEndpoint,
} = require('librechat-data-provider');
const azureAssistants = require('~/server/services/Endpoints/azureAssistants');
const assistants = require('~/server/services/Endpoints/assistants');
const { getEndpointsConfig } = require('~/server/services/Config');
const agents = require('~/server/services/Endpoints/agents');
const { updateFilesUsage } = require('~/models');

const buildFunction = {
  [EModelEndpoint.agents]: agents.buildOptions,
  [EModelEndpoint.assistants]: assistants.buildOptions,
  [EModelEndpoint.azureAssistants]: azureAssistants.buildOptions,
};

async function buildEndpointOption(req, res, next) {
  const { endpoint, endpointType } = req.body;

  let endpointsConfig;
  try {
    endpointsConfig = await getEndpointsConfig(req);
  } catch (error) {
    logger.error('Error fetching endpoints config in buildEndpointOption', error);
  }

  const defaultParamsEndpoint = getDefaultParamsEndpoint(endpointsConfig, endpoint);

  let parsedBody;
  try {
    parsedBody = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: req.body,
      defaultParamsEndpoint,
    });
  } catch (error) {
    logger.error(`Error parsing compact conversation for endpoint ${endpoint}`, error);
    logger.debug({
      'Error parsing compact conversation': { endpoint, endpointType, conversation: req.body },
    });
    return handleError(res, { text: 'Error parsing conversation' });
  }

  const appConfig = req.config;

  // ⭐ ЖЁСТКОЕ ОТКЛЮЧЕНИЕ: Требуем req.body.model БЕЗ FALLBACK
  // Никаких defaults, никаких endpoint-specific models, никаких specs
  const requestedModel = req.body?.model;

  if (!requestedModel) {
    logger.error('[buildEndpointOption] 🔴 NO MODEL PROVIDED - rejecting request');
    return handleError(res, { text: 'Model is required - user must explicitly select a model' });
  }

  logger.info(`[buildEndpointOption] ⭐ USER EXPLICITLY SELECTED MODEL: ${requestedModel}`);

  // ТОЛЬКО используем явно выбранную модель
  parsedBody.model = requestedModel;

  // ⭐ ОТКЛЮЧЕНО: Никакой логики с spec, никаких defaults, никаких preset overrides
  // Старая система:
  // - брала spec и парсила currentModelSpec.preset
  // - подставляла default model для endpoint
  // - использовала modelSpecs для переписывания model
  //
  // НОВАЯ система:
  // - ТОЛЬКО req.body.model
  // - НИКАКИХ fallback и автоматического назначения

  console.log('[buildEndpointOption] ⭐ MODEL ASSIGNMENT:', {
    requested: requestedModel,
    assigned: parsedBody.model,
    source: 'req.body.model (user explicit selection only)',
  });

  try {
    const isAgents =
      isAgentsEndpoint(endpoint) || req.baseUrl.startsWith(EndpointURLs[EModelEndpoint.agents]);
    const builder = isAgents
      ? (...args) => buildFunction[EModelEndpoint.agents](req, ...args)
      : buildFunction[endpointType ?? endpoint];

    // TODO: use object params
    req.body = req.body || {}; // Express 5: ensure req.body exists
    req.body.endpointOption = await builder(endpoint, parsedBody, endpointType);

    // ⭐ ФИНАЛЬНАЯ ПРОВЕРКА: endpointOption.model должен быть ТОЛЬКО из req.body.model
    if (req.body.endpointOption && parsedBody.model) {
      req.body.endpointOption.model = parsedBody.model;
      console.log('[buildEndpointOption] ⭐ FINAL CHECK - MODEL IN ENDPOINT OPTION:', {
        parsedBodyModel: parsedBody.model,
        endpointOptionModel: req.body.endpointOption.model,
        match: parsedBody.model === req.body.endpointOption.model,
      });
      logger.info(`[buildEndpointOption] ⭐ MODEL LOCKED: ${parsedBody.model}`, {
        source: 'User explicit selection (req.body.model)',
        endpoint,
        endpointType,
      });
    }

    if (req.body.files && !isAgents) {
      req.body.endpointOption.attachments = updateFilesUsage(req.body.files);
    }

    next();
  } catch (error) {
    logger.error(
      `Error building endpoint option for endpoint ${endpoint} with type ${endpointType}`,
      error,
    );
    return handleError(res, { text: 'Error building endpoint option' });
  }
}

module.exports = buildEndpointOption;
