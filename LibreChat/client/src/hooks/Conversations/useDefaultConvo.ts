import { useQuery } from '@tanstack/react-query';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { excludedKeys, getDefaultParamsEndpoint } from 'librechat-data-provider';
import type {
  TEndpointsConfig,
  TModelsConfig,
  TConversation,
  TPreset,
} from 'librechat-data-provider';
import { getDefaultEndpoint, buildDefaultConvo } from '~/utils';
import { useGetEndpointsQuery } from '~/data-provider';

type TDefaultConvo = {
  conversation: Partial<TConversation>;
  preset?: Partial<TPreset> | null;
  cleanInput?: boolean;
  cleanOutput?: boolean;
};

const exceptions = new Set(['spec', 'iconURL']);

const useDefaultConvo = () => {
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();
  const { data: modelsConfig = {} as TModelsConfig } = useGetModelsQuery();
  const { data: allowedModelsData } = useQuery({
    queryKey: ['allowedModels'],
    queryFn: async () => {
      const res = await fetch('/api/models/allowed', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 60_000,
  });

  const getDefaultConversation = ({
    conversation: _convo,
    preset,
    cleanInput,
    cleanOutput,
  }: TDefaultConvo) => {
    const endpoint = getDefaultEndpoint({
      convoSetup: preset as TPreset,
      endpointsConfig,
    });

    // Use ONLY allowed models for the user's plan, not all models in the system
    let models: string[] = [];
    if (allowedModelsData && endpoint) {
      // allowedModelsData is organized by endpoint: { anthropic: [...], openai: [...] }
      models = (allowedModelsData[endpoint] as string[]) || [];
    }
    // Fallback to modelsConfig if allowed models not loaded yet
    if (models.length === 0) {
      models = modelsConfig[endpoint ?? ''] || [];
    }

    const conversation = { ..._convo };
    if (cleanInput === true) {
      for (const key in conversation) {
        if (excludedKeys.has(key) && !exceptions.has(key)) {
          continue;
        }
        if (conversation[key] == null) {
          continue;
        }
        conversation[key] = undefined;
      }
    }

    const defaultParamsEndpoint = getDefaultParamsEndpoint(endpointsConfig, endpoint);

    const defaultConvo = buildDefaultConvo({
      conversation: conversation as TConversation,
      endpoint,
      lastConversationSetup: preset as TConversation,
      models,
      defaultParamsEndpoint,
    });

    if (!cleanOutput) {
      return defaultConvo;
    }

    for (const key in defaultConvo) {
      if (excludedKeys.has(key) && !exceptions.has(key)) {
        continue;
      }
      if (defaultConvo[key] == null) {
        continue;
      }
      defaultConvo[key] = undefined;
    }

    return defaultConvo;
  };

  return getDefaultConversation;
};

export default useDefaultConvo;
