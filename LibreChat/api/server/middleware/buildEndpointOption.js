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

  // ===== SPEC-FIRST АРХИТЕКТУРА =====
  // Если modelSpecs.enforce = true, используем ТОЛЬКО spec → preset.model
  if (appConfig.modelSpecs?.enforce === true) {
    const spec = req.body?.spec;

    if (!spec) {
      logger.error('[buildEndpointOption] 🔴 SPEC-FIRST MODE: spec is required');
      return handleError(res, {
        text: 'spec is required when modelSpecs.enforce = true',
        code: 'SPEC_REQUIRED',
      });
    }

    // Найти modelSpec в конфиге
    const modelSpec = appConfig.modelSpecs.list?.find((s) => s.name === spec);
    if (!modelSpec) {
      logger.error(`[buildEndpointOption] 🔴 SPEC NOT FOUND: "${spec}"`);
      return handleError(res, {
        text: `Model spec "${spec}" not found in configuration`,
        code: 'SPEC_NOT_FOUND',
      });
    }

    // Взять endpoint и model из spec.preset
    const specEndpoint = modelSpec.preset?.endpoint;
    const specModel = modelSpec.preset?.model;

    if (!specEndpoint || !specModel) {
      logger.error(`[buildEndpointOption] 🔴 INVALID SPEC PRESET: "${spec}"`, modelSpec.preset);
      return handleError(res, {
        text: `Invalid spec preset for "${spec}"`,
        code: 'INVALID_SPEC_PRESET',
      });
    }

    // Применить preset из spec
    parsedBody.endpoint = specEndpoint;
    parsedBody.model = specModel;
    parsedBody.spec = spec;

    logger.info(`[buildEndpointOption] ✅ SPEC-FIRST: "${spec}" → endpoint="${specEndpoint}", model="${specModel}"`, {
      spec,
      endpoint: specEndpoint,
      model: specModel,
    });
  } else {
    // ===== FALLBACK: MODE-FIRST АРХИТЕКТУРА (для совместимости) =====
    // Если enforce = false, можно использовать model напрямую
    const requestedModel = req.body?.model;

    if (requestedModel) {
      parsedBody.model = requestedModel;
      logger.info(`[buildEndpointOption] MODEL-FIRST (fallback): "${requestedModel}"`, {
        model: requestedModel,
      });
    }
  }

  try {
    const isAgents =
      isAgentsEndpoint(parsedBody.endpoint || endpoint) ||
      req.baseUrl.startsWith(EndpointURLs[EModelEndpoint.agents]);
    const builder = isAgents
      ? (...args) => buildFunction[EModelEndpoint.agents](req, ...args)
      : buildFunction[endpointType ?? (parsedBody.endpoint || endpoint)];

    // TODO: use object params
    req.body = req.body || {}; // Express 5: ensure req.body exists
    req.body.endpointOption = await builder(parsedBody.endpoint || endpoint, parsedBody, endpointType);

    if (req.body.files && !isAgents) {
      req.body.endpointOption.attachments = updateFilesUsage(req.body.files);
    }

    logger.info(`[buildEndpointOption] ✅ BUILT ENDPOINT OPTION`, {
      spec: req.body?.spec,
      model: parsedBody.model,
      endpoint: parsedBody.endpoint,
    });

    next();
  } catch (error) {
    logger.error(
      `Error building endpoint option for endpoint ${parsedBody.endpoint || endpoint} with type ${endpointType}`,
      error,
    );
    return handleError(res, { text: 'Error building endpoint option' });
  }
}

module.exports = buildEndpointOption;
