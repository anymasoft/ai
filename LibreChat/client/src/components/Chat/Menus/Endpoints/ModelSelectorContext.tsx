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
  useAuthContext,
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
  const { token } = useAuthContext();
  const agentsMap = useAgentsMapContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { endpoint, model, spec, agent_id, assistant_id, conversation, newConversation } =
    useModelSelectorChatContext();
  const localize = useLocalize();
  const { announcePolite } = useLiveAnnouncer();

  /**
   * Загружаем план пользователя и его allowedModels
   */
  const { data: userPlanData } = useQuery({
    queryKey: ['userPlan'],
    queryFn: async (): Promise<{ plan: string; allowedModels: string[] } | null> => {
      const res = await fetch('/api/auth/plan', {
        credentials: 'include',
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 60_000,
  });

  const modelSpecs = useMemo(() => {
    const specs = startupConfig?.modelSpecs?.list ?? [];

    // Фильтруем по агентам (если есть)
    const filteredByAgents = specs.filter((spec) => {
      if (!agentsMap) return true;
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return spec.preset.agent_id in agentsMap;
      }
      return true;
    });

    // Фильтруем по allowedModels текущего плана пользователя
    if (!userPlanData?.allowedModels) return filteredByAgents;

    const allowedModels = userPlanData.allowedModels;
    if (allowedModels.length === 0) {
      // Пустой список = все модели разрешены
      return filteredByAgents;
    }

    // Фильтруем: модель разрешена если её имя содержит одно из allowedModels
    return filteredByAgents.filter((spec) => {
      const modelName = spec.name?.toLowerCase() || '';
      return allowedModels.some((allowed) => modelName.includes(allowed.toLowerCase()));
    });
  }, [startupConfig, agentsMap, userPlanData]);

  const permissionLevel = useAgentDefaultPermissionLevel();
  const { data: agents = null } = useListAgentsQuery(
    { requiredPermission: permissionLevel },
    {
      select: (data) => data?.data,
    },
  );

  const { mappedEndpoints: rawMappedEndpoints, endpointRequiresUserKey } = useEndpoints({
    agents,
    assistantsMap,
    startupConfig,
    endpointsConfig,
  });

  /**
   * Загружаем разрешённые модели из БД (Plans + AiModel).
   * Каждая запись содержит { modelId, displayName, endpointKey } — достаточно для
   * генерации синтетического TModelSpec без привязки к LibreChat-конфигу.
   *
   * Состояния allowedModelsData:
   *   undefined  — запрос ещё в полёте (isLoading)
   *   null       — запрос вернул ошибку (res.ok === false)
   *   { models } — успешный ответ (models может быть пустым массивом)
   */
  type AllowedModel = { modelId: string; displayName: string; provider: string; endpointKey: string };
  const { data: allowedModelsData, isLoading: allowedLoading } = useQuery({
    queryKey: ['allowedModels', token],
    queryFn: async (): Promise<{ models: AllowedModel[]; plan: string } | null> => {
      if (!token) return null;
      const res = await fetch('/api/models/allowed', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 60_000,
    enabled: !!token,
  });

  /**
   * Преобразуем список разрешённых моделей в синтетические TModelSpec.
   *
   * Возвращает:
   *   null     — запрос ещё не завершён (показываем YAML-спеки как запасной вариант)
   *   []       — запрос завершён, но моделей нет (показываем пустой список)
   *   [...]    — список синтетических спеков для отображения
   *
   * Когда dynamicModelSpecs !== null:
   *   - mappedEndpoints = [] (скрываем все эндпоинт-модели LibreChat)
   *   - modelSpecs      = dynamicModelSpecs (только модели из БД)
   */
  /** Встроенные эндпоинты LibreChat — иконки берутся из icons map по ключу.
   *  Кастомные эндпоинты (deepseek и др.) используют 'custom' → CustomMinimalIcon */
  const builtinEndpoints = new Set(['openAI', 'anthropic', 'google', 'azureOpenAI', 'bedrock', 'agents', 'assistants', 'azureAssistants']);

  const dynamicModelSpecs = useMemo((): t.TModelSpec[] | null => {
    // allowedLoading = true: запрос ещё в полёте → возвращаем null (показываем loading/empty)
    if (allowedLoading) return null;

    // allowedModelsData = null: ошибка запроса → возвращаем null (показываем ошибку)
    if (allowedModelsData === null) return null;

    // !allowedModelsData: данные ещё не загружены → возвращаем null
    if (!allowedModelsData) return null;

    // !endpointsConfig: конфиг эндпоинтов ещё не загружен → возвращаем null
    if (!endpointsConfig) return null;

    // Создаём синтетические TModelSpec ТОЛЬКО из разрешённых моделей
    // Без YAML моделей - ТОЛЬКО /api/models/allowed!
    return allowedModelsData.models
      .filter((m) => endpointsConfig[m.endpointKey] != null)
      .map((m) => ({
        name: m.modelId,
        label: m.displayName,
        iconURL: builtinEndpoints.has(m.endpointKey) ? m.endpointKey : 'custom',
        preset: {
          endpoint: m.endpointKey,
          model: m.modelId,
        },
      } as unknown as t.TModelSpec));
  }, [allowedModelsData, allowedLoading, endpointsConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // НИКАКОГО ФОЛБЭКА НА YAML МОДЕЛИ!
  // effectiveModelSpecs = dynamicModelSpecs (или пусто если загружается)
  const effectiveModelSpecs = dynamicModelSpecs ?? [];

  // Эндпоинты показываются ТОЛЬКО если нет dynamicModelSpecs
  // (это значит, что либо загружаются, либо ошибка - не показываем YAML эндпоинты)
  const mappedEndpoints = dynamicModelSpecs !== null ? [] : rawMappedEndpoints;

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
    const allItems = [...effectiveModelSpecs, ...mappedEndpoints];
    return filterItems(allItems, searchValue, agentsMap, assistantsMap || {});
  }, [searchValue, effectiveModelSpecs, mappedEndpoints, agentsMap, assistantsMap]);

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
    modelSpecs: effectiveModelSpecs,
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
