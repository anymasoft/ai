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
  useSubscription,
} from '~/hooks';
import { useAgentsMapContext, useAssistantsMapContext, useLiveAnnouncer } from '~/Providers';
import { useGetEndpointsQuery, useListAgentsQuery } from '~/data-provider';
import { useModelSelectorChatContext } from './ModelSelectorChatContext';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { filterItems } from './utils';

/**
 * Конвертирует endpointKey из AiModel в строку эндпоинта LibreChat
 * Используется для построения modelSpecs из результата /api/models/allowed
 */
function mapEndpointKeyToEndpoint(endpointKey: string): string {
  // endpointKey уже содержит правильное имя эндпоинта (openAI, anthropic, deepseek и т.д.)
  return endpointKey;
}

/**
 * Построить endpoints только из разрешённых моделей
 * Фильтрует endpoints, оставляя только те которые содержат разрешённые модели
 */
function buildEndpointsFromAllowedModels(
  allowedModels: Array<{
    modelId: string;
    displayName: string;
    provider: string;
    endpointKey: string;
  }>,
  startupConfig: t.TStartupConfig | undefined,
): Endpoint[] {
  if (!allowedModels || !startupConfig?.endpoints) {
    return [];
  }

  // Получить все уникальные endpoint'ы из разрешённых моделей
  const allowedEndpointKeys = new Set(allowedModels.map(m => m.endpointKey));

  // Сгруппировать разрешённые модели по endpoint
  const modelsByEndpoint = new Map<string, typeof allowedModels>();
  for (const model of allowedModels) {
    if (!modelsByEndpoint.has(model.endpointKey)) {
      modelsByEndpoint.set(model.endpointKey, []);
    }
    modelsByEndpoint.get(model.endpointKey)!.push(model);
  }

  // Отфильтровать endpoints из startupConfig, оставить только разрешённые
  // И подставить разрешённые модели вместо всех моделей из startupConfig
  const filteredEndpoints: Endpoint[] = [];

  for (const endpoint of startupConfig.endpoints) {
    if (!allowedEndpointKeys.has(endpoint.value)) {
      // Пропустить endpoint, если в нём нет разрешённых моделей
      continue;
    }

    const allowedEndpointModels = modelsByEndpoint.get(endpoint.value);
    if (!allowedEndpointModels) {
      continue;
    }

    // Создать новый endpoint только с разрешёнными моделями
    const filteredEndpoint: Endpoint = {
      ...endpoint,
      models: allowedEndpointModels.map(m => ({
        name: m.modelId,
        label: m.displayName,
      })) as any,
    };

    console.log('[ENDPOINTS_REFACTOR] Filtered endpoint:', {
      value: filteredEndpoint.value,
      label: filteredEndpoint.label,
      totalModels: filteredEndpoint.models?.length || 0,
      models: filteredEndpoint.models?.map(m => m.name),
    });

    filteredEndpoints.push(filteredEndpoint);
  }

  console.log('[ENDPOINTS_REFACTOR] buildEndpointsFromAllowedModels result:', {
    totalEndpoints: filteredEndpoints.length,
    endpoints: filteredEndpoints.map(e => ({
      value: e.value,
      modelCount: e.models?.length || 0,
    })),
  });

  return filteredEndpoints;
}

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

  // ✅ SSOT: Получение плана из единого источника
  const { data: subscription } = useSubscription();

  // Query для получения ВСЕ ДОСТУПНЫХ моделей (независимо от плана)
  const allModelsQuery = useQuery({
    queryKey: ['models/all'],
    queryFn: async () => {
      console.log('[MODELS_DIAGNOSTIC] Starting fetch GET /api/models/all');
      const res = await fetch('/api/models/all', {
        credentials: 'include',
      });
      console.log('[MODELS_DIAGNOSTIC] GET /api/models/all response status:', res.status);

      if (!res.ok) {
        console.error('[MODELS_DIAGNOSTIC] GET /api/models/all failed with status:', res.status);
        throw new Error('Failed to load models');
      }

      const data = await res.json();
      console.log('[MODELS_DIAGNOSTIC] GET /api/models/all response data:', data);
      console.log('[MODELS_DIAGNOSTIC] Models count:', data.models?.length);
      console.log('[MODELS_DIAGNOSTIC] Models:', data.models?.map((m: any) => m.modelId));

      return data as {
        models: Array<{
          modelId: string;
          displayName: string;
          provider: string;
          endpointKey: string;
        }>;
        [key: string]: any;
      };
    },
    staleTime: 5 * 60_000, // 5 минут (редко меняется)
    gcTime: 10 * 60_000,   // 10 минут в памяти
  });

  // Построить modelSpecs из доступных моделей, фильтруя по allowedModels из subscription
  const modelSpecs = useMemo(() => {
    console.log('[MODELS_DIAGNOSTIC] subscription.allowedModels:', subscription?.allowedModels);
    console.log('[MODELS_DIAGNOSTIC] allModelsQuery.data:', allModelsQuery.data);
    console.log('[MODELS_DIAGNOSTIC] allModelsQuery.isLoading:', allModelsQuery.isLoading);

    // ✅ SSOT: Если есть data из subscription и allModels, фильтруем
    if (allModelsQuery.data?.models && Array.isArray(allModelsQuery.data.models) && subscription?.allowedModels) {
      console.log('[MODELS_DIAGNOSTIC] Using allowedModels from subscription, count:', subscription.allowedModels.length);

      // Создаём set allowedModels для быстрого поиска
      const allowedSet = new Set(subscription.allowedModels);

      // Фильтруем модели по allowedModels из subscription
      const filteredModels = allModelsQuery.data.models.filter(m => allowedSet.has(m.modelId));
      console.log('[MODELS_DIAGNOSTIC] Filtered models count:', filteredModels.length);

      const specs = filteredModels.map((model) => ({
        name: model.modelId,
        label: model.displayName,
        preset: {
          endpoint: mapEndpointKeyToEndpoint(model.endpointKey),
          model: model.modelId,
        },
      })) as t.TModelSpec[];

      console.log('[MODELS_DIAGNOSTIC] Mapped specs from subscription:', specs.map(s => s.name));

      // Фильтрация по агентам
      if (!agentsMap) {
        console.log('[MODELS_DIAGNOSTIC] No agentsMap, returning specs as is');
        return specs;
      }

      const filtered = specs.filter((spec) => {
        if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
          return spec.preset.agent_id in agentsMap;
        }
        return true;
      });
      console.log('[MODELS_DIAGNOSTIC] Filtered specs after agents filter:', filtered.map(s => s.name));
      return filtered;
    }

    // Fallback на startupConfig если ещё загружается
    console.log('[MODELS_DIAGNOSTIC] FALLBACK to startupConfig.modelSpecs');
    console.log('[MODELS_DIAGNOSTIC] startupConfig.modelSpecs.list count:', startupConfig?.modelSpecs?.list?.length);

    const specs = startupConfig?.modelSpecs?.list ?? [];
    if (!agentsMap) {
      console.log('[MODELS_DIAGNOSTIC] No agentsMap (fallback), returning startup specs as is');
      return specs;
    }

    const filtered = specs.filter((spec) => {
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return spec.preset.agent_id in agentsMap;
      }
      return true;
    });
    console.log('[MODELS_DIAGNOSTIC] Filtered startup specs after agents filter:', filtered.map(s => s.name));
    return filtered;
  }, [allModelsQuery.data, subscription?.allowedModels, agentsMap, startupConfig]);

  // ДИАГНОСТИКА: Логируем финальный массив
  console.log('[MODELS_DIAGNOSTIC] FINAL modelSpecs for selector:', modelSpecs.map(m => m.name));

  const permissionLevel = useAgentDefaultPermissionLevel();
  const { data: agents = null } = useListAgentsQuery(
    { requiredPermission: permissionLevel },
    {
      select: (data) => data?.data,
    },
  );

  // НОВОЕ: Построить endpoints только из разрешённых моделей
  const allowedEndpoints = useMemo(() => {
    if (allModelsQuery.data?.models) {
      console.log('[MODELS_DIAGNOSTIC] Building endpoints from allowedModels, count:', allModelsQuery.data.models.length);
      const endpoints = buildEndpointsFromAllowedModels(allModelsQuery.data.models, startupConfig);
      console.log('[MODELS_DIAGNOSTIC] Built endpoints from API, count:', endpoints.length);
      return endpoints;
    }

    // Fallback на старую логику если данные не загрузились
    console.log('[MODELS_DIAGNOSTIC] FALLBACK: Using startupConfig.endpoints (all models)');
    return startupConfig?.endpoints ?? [];
  }, [allModelsQuery.data?.models, startupConfig]);

  // Используем старый useEndpoints для получения endpointRequiresUserKey и других функций
  // но с отфильтрованными endpoints
  const { mappedEndpoints: _unused, endpointRequiresUserKey } = useEndpoints({
    agents,
    assistantsMap,
    startupConfig,
    endpointsConfig,
  });

  // Используем allowedEndpoints вместо mappedEndpoints из useEndpoints
  const mappedEndpoints = useMemo(() => {
    console.log('[ENDPOINTS_REFACTOR] Final mappedEndpoints:', {
      count: allowedEndpoints.length,
      endpoints: allowedEndpoints.map(e => ({
        value: e.value,
        label: e.label,
        modelCount: e.models?.length || 0,
      })),
    });
    return allowedEndpoints;
  }, [allowedEndpoints]);

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
    mappedEndpoints,
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
