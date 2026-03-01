import debounce from 'lodash/debounce';
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EModelEndpoint, isAgentsEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import {
  useAgentDefaultPermissionLevel,
  useSelectorEffects,
  useKeyDialog,
  useEndpoints,
  useLocalize,
} from '~/hooks';
import { useAgentsMapContext, useAssistantsMapContext, useLiveAnnouncer } from '~/Providers';
import { useGetEndpointsQuery, useListAgentsQuery } from '~/data-provider';
import { useModelSelectorChatContext } from './ModelSelectorChatContext';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { filterItems } from './utils';

type ModelSelectorContextType = {
  // State
  searchValue: string;
  selectedValues: SelectedValues;
  endpointSearchValues: Record<string, string>;
  searchResults: (t.TModelSpec | Endpoint)[] | null;
  // LibreChat
  modelSpecs: t.TModelSpec[];
  mappedEndpoints: Endpoint[];
  agentsMap: t.TAgentsMap | undefined;
  assistantsMap: t.TAssistantsMap | undefined;
  endpointsConfig: t.TEndpointsConfig;

  // Functions
  endpointRequiresUserKey: (endpoint: string) => boolean;
  setSelectedValues: React.Dispatch<React.SetStateAction<SelectedValues>>;
  setSearchValue: (value: string) => void;
  setEndpointSearchValue: (endpoint: string, value: string) => void;
  handleSelectSpec: (spec: t.TModelSpec) => void;
  handleSelectEndpoint: (endpoint: Endpoint) => void;
  handleSelectModel: (endpoint: Endpoint, model: string) => void;
} & ReturnType<typeof useKeyDialog>;

const ModelSelectorContext = createContext<ModelSelectorContextType | undefined>(undefined);

export function useModelSelectorContext() {
  const context = useContext(ModelSelectorContext);
  if (context === undefined) {
    throw new Error('useModelSelectorContext must be used within a ModelSelectorProvider');
  }
  return context;
}

interface ModelSelectorProviderProps {
  children: React.ReactNode;
  startupConfig: t.TStartupConfig | undefined;
}

export function ModelSelectorProvider({ children, startupConfig }: ModelSelectorProviderProps) {
  const agentsMap = useAgentsMapContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { endpoint, model, spec, agent_id, assistant_id, conversation, newConversation } =
    useModelSelectorChatContext();
  const localize = useLocalize();
  const { announcePolite } = useLiveAnnouncer();

  /**
   * Получаем список разрешённых моделей для текущего пользователя (по его тарифу).
   * API возвращает: { models: [ { modelId, provider, endpointKey, displayName } ], plan }
   * Кэш: 60 секунд
   */
  const { data: allowedModelsData } = useQuery({
    queryKey: ['allowedModels'],
    queryFn: async () => {
      const res = await fetch('/api/models/allowed', { credentials: 'include' });
      if (!res.ok) return null;
      const json = await res.json();
      return json;
    },
    staleTime: 60_000,
    gcTime: 60_000,
  });

  // Флаг: успешно ли загружены разрешённые модели (true если ответ получен, false если ошибка)
  const hasLoadedAllowedModels = allowedModelsData !== undefined && allowedModelsData !== null;

  const allowedModelIds = new Set(allowedModelsData?.models?.map((m: any) => m.modelId) ?? []);

  const modelSpecs = useMemo(() => {
    const specs = startupConfig?.modelSpecs?.list ?? [];

    /**
     * Filter modelSpecs by:
     * 1. Agents the user has access to (agentsMap)
     * 2. Models allowed by user's subscription plan (allowedModels)
     */
    return specs.filter((spec) => {
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return agentsMap && spec.preset.agent_id in agentsMap;
      }

      /**
       * Filter by user's subscription plan
       * Only show models that are in allowedModelIds
       */
      if (spec.preset?.model && allowedModelIds.size > 0) {
        return allowedModelIds.has(spec.preset.model);
      }

      /** Keep non-agent modelSpecs if no allowed models restriction */
      return allowedModelIds.size === 0;
    });
  }, [startupConfig, agentsMap, allowedModelIds]);

  const permissionLevel = useAgentDefaultPermissionLevel();
  const { data: agents = null } = useListAgentsQuery(
    { requiredPermission: permissionLevel },
    {
      select: (data) => data?.data,
    },
  );

  const { mappedEndpoints, endpointRequiresUserKey } = useEndpoints({
    agents,
    assistantsMap,
    startupConfig,
    endpointsConfig,
  });

  /**
   * Filter endpoints to only show those that have models in the user's allowed models.
   * This prevents showing empty endpoint sections for models the user doesn't have access to.
   *
   * TODO: Agents and Assistants endpoints are currently hidden (commented out below).
   * Uncomment the code to enable them when ready to support them.
   */
  const filteredMappedEndpoints = useMemo(() => {
    if (!mappedEndpoints) {
      return mappedEndpoints;
    }

    // Filter out agents and assistants endpoints
    const withoutAgentsAssistants = mappedEndpoints.filter(
      (endpoint) =>
        !isAgentsEndpoint(endpoint.value) && !isAssistantsEndpoint(endpoint.value),
    );

    // Only apply filtering if allowedModels were successfully loaded from API
    // If API failed to load (hasLoadedAllowedModels = false), show all models as fallback
    if (!hasLoadedAllowedModels) {
      return withoutAgentsAssistants;
    }

    // If allowedModelIds is empty after successful load, it means all models are allowed
    if (allowedModelIds.size === 0) {
      return withoutAgentsAssistants;
    }

    // For regular endpoints, filter models to only allowed ones
    return withoutAgentsAssistants
      .map((endpoint) => {
        if (endpoint.models && Array.isArray(endpoint.models)) {
          const filteredModels = endpoint.models.filter((model: string) =>
            allowedModelIds.has(model),
          );

          // Only return endpoint if it has at least one allowed model
          if (filteredModels.length > 0) {
            return {
              ...endpoint,
              models: filteredModels,
            };
          }

          return null;
        }

        return endpoint;
      })
      .filter((ep): ep is Endpoint => ep !== null);
  }, [mappedEndpoints, allowedModelIds, hasLoadedAllowedModels]);

  const getModelDisplayName = useCallback(
    (endpoint: Endpoint, model: string): string => {
      if (isAgentsEndpoint(endpoint.value)) {
        return endpoint.agentNames?.[model] ?? agentsMap?.[model]?.name ?? model;
      }

      if (isAssistantsEndpoint(endpoint.value)) {
        return endpoint.assistantNames?.[model] ?? model;
      }

      return model;
    },
    [agentsMap],
  );

  const { onSelectEndpoint, onSelectSpec } = useSelectMention({
    // presets,
    modelSpecs,
    conversation,
    assistantsMap,
    endpointsConfig,
    newConversation,
    returnHandlers: true,
  });

  // State
  const [selectedValues, setSelectedValues] = useState<SelectedValues>(() => {
    let initialModel = model || '';
    if (isAgentsEndpoint(endpoint) && agent_id) {
      initialModel = agent_id;
    } else if (isAssistantsEndpoint(endpoint) && assistant_id) {
      initialModel = assistant_id;
    }
    return {
      endpoint: endpoint || '',
      model: initialModel,
      modelSpec: spec || '',
    };
  });
  useSelectorEffects({
    agentsMap,
    conversation: endpoint
      ? ({
          endpoint: endpoint ?? null,
          model: model ?? null,
          spec: spec ?? null,
          agent_id: agent_id ?? null,
          assistant_id: assistant_id ?? null,
        } as any)
      : null,
    assistantsMap,
    setSelectedValues,
  });

  const [searchValue, setSearchValueState] = useState('');
  const [endpointSearchValues, setEndpointSearchValues] = useState<Record<string, string>>({});

  const keyProps = useKeyDialog();

  /** Memoized search results */
  const searchResults = useMemo(() => {
    if (!searchValue) {
      return null;
    }
    const allItems = [...modelSpecs, ...mappedEndpoints];
    return filterItems(allItems, searchValue, agentsMap, assistantsMap || {});
  }, [searchValue, modelSpecs, mappedEndpoints, agentsMap, assistantsMap]);

  const setDebouncedSearchValue = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValueState(value);
      }, 200),
    [],
  );
  const setEndpointSearchValue = (endpoint: string, value: string) => {
    setEndpointSearchValues((prev) => ({
      ...prev,
      [endpoint]: value,
    }));
  };

  const handleSelectSpec = (spec: t.TModelSpec) => {
    let model = spec.preset.model ?? null;
    onSelectSpec?.(spec);
    if (isAgentsEndpoint(spec.preset.endpoint)) {
      model = spec.preset.agent_id ?? '';
    } else if (isAssistantsEndpoint(spec.preset.endpoint)) {
      model = spec.preset.assistant_id ?? '';
    }
    setSelectedValues({
      endpoint: spec.preset.endpoint,
      model,
      modelSpec: spec.name,
    });
  };

  const handleSelectEndpoint = (endpoint: Endpoint) => {
    if (!endpoint.hasModels) {
      if (endpoint.value) {
        onSelectEndpoint?.(endpoint.value);
      }
      setSelectedValues({
        endpoint: endpoint.value,
        model: '',
        modelSpec: '',
      });
    }
  };

  const handleSelectModel = (endpoint: Endpoint, model: string) => {
    if (isAgentsEndpoint(endpoint.value)) {
      onSelectEndpoint?.(endpoint.value, {
        agent_id: model,
        model: agentsMap?.[model]?.model ?? '',
      });
    } else if (isAssistantsEndpoint(endpoint.value)) {
      onSelectEndpoint?.(endpoint.value, {
        assistant_id: model,
        model: assistantsMap?.[endpoint.value]?.[model]?.model ?? '',
      });
    } else if (endpoint.value) {
      onSelectEndpoint?.(endpoint.value, { model });
    }
    setSelectedValues({
      endpoint: endpoint.value,
      model,
      modelSpec: '',
    });

    const modelDisplayName = getModelDisplayName(endpoint, model);
    const announcement = localize('com_ui_model_selected', { 0: modelDisplayName });
    announcePolite({ message: announcement, isStatus: true });
  };

  const value = {
    // State
    searchValue,
    searchResults,
    selectedValues,
    endpointSearchValues,
    // LibreChat
    agentsMap,
    modelSpecs,
    assistantsMap,
    mappedEndpoints: filteredMappedEndpoints,
    endpointsConfig,

    // Functions
    handleSelectSpec,
    handleSelectModel,
    setSelectedValues,
    handleSelectEndpoint,
    setEndpointSearchValue,
    endpointRequiresUserKey,
    setSearchValue: setDebouncedSearchValue,
    // Dialog
    ...keyProps,
  };

  return <ModelSelectorContext.Provider value={value}>{children}</ModelSelectorContext.Provider>;
}
