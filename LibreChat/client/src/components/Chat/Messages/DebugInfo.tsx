import React from 'react';

export interface DebugInfoData {
  requestedModel: string;
  actualModel: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenCreditsCharged: number;
  remainingTokenCredits: number;
}

interface DebugInfoProps {
  debug: DebugInfoData;
}

/**
 * Компонент для отображения debug информации о модели и расходе токенов
 * Показывается только при включенном debug mode на бэкенде
 */
export const DebugInfo: React.FC<DebugInfoProps> = ({ debug }) => {
  if (!debug) {
    return null;
  }

  const { actualModel, promptTokens, completionTokens, totalTokens, tokenCreditsCharged, remainingTokenCredits } = debug;

  return (
    <div className="mt-2 rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">
      <div className="text-gray-600 dark:text-gray-400">
        <div className="mb-1">
          <span className="font-semibold">Model:</span> <span className="font-mono">{actualModel}</span>
        </div>
        <div className="mb-1">
          <span className="font-semibold">Prompt:</span> <span className="font-mono">{promptTokens}</span> tokens
        </div>
        <div className="mb-1">
          <span className="font-semibold">Completion:</span> <span className="font-mono">{completionTokens}</span> tokens
        </div>
        <div className="mb-1">
          <span className="font-semibold">Total:</span> <span className="font-mono">{totalTokens}</span> tokens
        </div>
        <div className="mb-1">
          <span className="font-semibold">Charged:</span> <span className="font-mono">{tokenCreditsCharged}</span> TC
        </div>
        <div>
          <span className="font-semibold">Remaining:</span> <span className="font-mono">{remainingTokenCredits.toLocaleString()}</span> TC
        </div>
      </div>
    </div>
  );
};

export default DebugInfo;
