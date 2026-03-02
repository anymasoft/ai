import React, { useMemo, useCallback } from 'react';
import { TooltipAnchor } from '@librechat/client';
import { getConfigDefaults } from 'librechat-data-provider';
import type { ModelSelectorProps } from '~/common';
import {
  renderModelSpecs,
  renderEndpoints,
  renderSearchResults,
  renderCustomGroups,
} from './components';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { ModelSelectorChatProvider } from './ModelSelectorChatContext';
import { useChatContext } from '~/Providers/ChatContext';
import { getSelectedIcon, getDisplayValue } from './utils';
import { CustomMenu as Menu } from './CustomMenu';
import DialogManager from './DialogManager';
import { useLocalize } from '~/hooks';

function ModelSelectorContent() {
  const localize = useLocalize();
  const { conversation, setConversation } = useChatContext();

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    // State
    searchValue,
    searchResults,
    selectedValues,
    // Functions
    setSearchValue,
    setSelectedValues,
    // Dialog
    keyDialogOpen,
    onOpenChange,
    keyDialogEndpoint,
  } = useModelSelectorContext();

  const selectedIcon = useMemo(
    () =>
      getSelectedIcon({
        mappedEndpoints: mappedEndpoints ?? [],
        selectedValues,
        modelSpecs,
        endpointsConfig,
      }),
    [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig],
  );
  const selectedDisplayValue = useMemo(
    () =>
      getDisplayValue({
        localize,
        agentsMap,
        modelSpecs,
        selectedValues,
        mappedEndpoints,
      }),
    [localize, agentsMap, modelSpecs, selectedValues, mappedEndpoints],
  );

  // ===== SPEC-FIRST АРХИТЕКТУРА =====
  // Использовать ТОЛЬКО spec.name как источник истины
  // Не обновлять conversation.model, только conversation.spec
  const handleModelChange = useCallback(
    (values: Record<string, any>) => {
      const selectedSpec = values.modelSpec || '';

      console.log('[ModelSelector] ✅ SPEC-FIRST SELECTION:', {
        selectedSpec,
        previousSpec: conversation?.spec,
        previousModel: conversation?.model,
      });

      // Update selectedValues in context (for UI display)
      setSelectedValues({
        endpoint: '',  // ← не используется в spec-first архитектуре
        model: '',     // ← не используется в spec-first архитектуре
        modelSpec: selectedSpec, // ← ГЛАВНОЕ: выбранный spec
      });

      // ===== КРИТИЧНО: ТОЛЬКО обновлять conversation.spec =====
      // Backend будет использовать spec для определения endpoint и model через buildEndpointOption
      if (selectedSpec) {
        console.log('[ModelSelector] ✅ SPEC-FIRST: DIRECTLY SETTING conversation.spec to:', selectedSpec);
        setConversation((prev) => ({
          ...prev,
          spec: selectedSpec,
          // НЕ обновляем conversation.model - это будет определено spec.preset.model на backend
          // НЕ обновляем conversation.endpoint - это будет определено spec.preset.endpoint на backend
        }));
      }
    },
    [conversation?.spec, setConversation, setSelectedValues],
  );

  const trigger = (
    <TooltipAnchor
      aria-label={localize('com_ui_select_model')}
      description={localize('com_ui_select_model')}
      render={
        <button
          className="my-1 flex h-10 w-full max-w-[70vw] items-center justify-center gap-2 rounded-xl border border-border-light bg-presentation px-3 py-2 text-sm text-text-primary hover:bg-surface-active-alt"
          aria-label={localize('com_ui_select_model')}
        >
          {selectedIcon && React.isValidElement(selectedIcon) && (
            <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
              {selectedIcon}
            </div>
          )}
          <span className="flex-grow truncate text-left">{selectedDisplayValue}</span>
        </button>
      }
    />
  );

  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-2">
      <Menu
        values={selectedValues}
        onValuesChange={handleModelChange}
        onSearch={(value) => setSearchValue(value)}
        combobox={<input id="model-search" placeholder=" " />}
        comboboxLabel={localize('com_endpoint_search_models')}
        trigger={trigger}
      >
        {searchResults ? (
          renderSearchResults(searchResults, localize, searchValue)
        ) : (
          <>
            {/* Render ungrouped modelSpecs (no group field) */}
            {renderModelSpecs(
              modelSpecs?.filter((spec) => !spec.group) || [],
              selectedValues.modelSpec || '',
            )}
            {/* Render endpoints (will include grouped specs matching endpoint names) */}
            {renderEndpoints(mappedEndpoints ?? [])}
            {/* Render custom groups (specs with group field not matching any endpoint) */}
            {renderCustomGroups(modelSpecs || [], mappedEndpoints ?? [])}
          </>
        )}
      </Menu>
      <DialogManager
        keyDialogOpen={keyDialogOpen}
        onOpenChange={onOpenChange}
        endpointsConfig={endpointsConfig || {}}
        keyDialogEndpoint={keyDialogEndpoint || undefined}
      />
    </div>
  );
}

export default function ModelSelector({ startupConfig }: ModelSelectorProps) {
  const interfaceConfig = startupConfig?.interface ?? getConfigDefaults().interface;
  const modelSpecs = startupConfig?.modelSpecs?.list ?? [];

  // Hide the selector when modelSelect is false and there are no model specs to show
  if (interfaceConfig.modelSelect === false && modelSpecs.length === 0) {
    return null;
  }

  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
