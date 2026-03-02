import { useState, useEffect } from 'react';
import type { TConversation } from 'librechat-data-provider';
import type { TSetOption } from '~/common';
import { multiChatOptions } from './options';

type TGoogleProps = {
  showExamples: boolean;
  isCodeChat: boolean;
};

type TSelectProps = {
  conversation: TConversation | null;
  setOption: TSetOption;
  extraProps?: TGoogleProps;
  showAbove?: boolean;
  popover?: boolean;
};

export default function ModelSelect({
  conversation,
  setOption,
  popover = false,
  showAbove = true,
}: TSelectProps) {
  // SINGLE SOURCE: Load ONLY allowed models for current user
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    const fetchAllowedModels = async () => {
      try {
        const res = await fetch('/api/models/allowed', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch allowed models');
        const data = await res.json();
        setModels(data[conversation?.endpoint] ?? []);
      } catch (error) {
        console.error('[ModelSelect] Error fetching allowed models:', error);
        setModels([]);
      }
    };

    if (conversation?.endpoint) {
      fetchAllowedModels();
    }
  }, [conversation?.endpoint]);

  if (!conversation?.endpoint) {
    return null;
  }

  const { endpoint: _endpoint, endpointType } = conversation;
  const endpoint = endpointType ?? _endpoint;

  const OptionComponent = multiChatOptions[endpoint];

  if (!OptionComponent) {
    return null;
  }

  return (
    <OptionComponent
      conversation={conversation}
      setOption={setOption}
      models={models}
      showAbove={showAbove}
      popover={popover}
    />
  );
}
