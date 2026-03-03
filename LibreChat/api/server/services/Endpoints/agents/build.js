const { logger } = require('@librechat/data-schemas');
const { isAgentsEndpoint, removeNullishValues, Constants } = require('librechat-data-provider');
const { loadAgent } = require('~/models/Agent');

const buildOptions = (req, endpoint, parsedBody, endpointType) => {
  const { spec, iconURL, agent_id, ...model_parameters } = parsedBody;

  // DEBUG: Log what we receive in buildOptions
  logger.info('[buildOptions] DEBUG: Input parameters', {
    endpoint,
    agent_id,
    spec,
    model_parameters,
    parsedBodyModel: parsedBody.model,
  });

  const agentPromise = loadAgent({
    req,
    spec,
    agent_id: isAgentsEndpoint(endpoint) ? agent_id : Constants.EPHEMERAL_AGENT_ID,
    endpoint,
    model_parameters,
  }).catch((error) => {
    logger.error(`[/agents/:${agent_id}] Error retrieving agent during build options step`, error);
    return undefined;
  });

  // DEBUG: Log loaded agent
  agentPromise.then((agent) => {
    if (agent) {
      logger.info('[buildOptions] DEBUG: Loaded agent', {
        agentId: agent.id,
        agentModel: agent.model,
        agentProvider: agent.provider,
      });
    }
  });

  /** @type {import('librechat-data-provider').TConversation | undefined} */
  const addedConvo = req.body?.addedConvo;

  return removeNullishValues({
    spec,
    iconURL,
    endpoint,
    agent_id,
    endpointType,
    model_parameters,
    agent: agentPromise,
    addedConvo,
  });
};

module.exports = { buildOptions };
