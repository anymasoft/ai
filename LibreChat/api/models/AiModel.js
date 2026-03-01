'use strict';
/**
 * AiModel — каталог доступных AI-моделей.
 * Единственный источник истины для списка моделей, их displayName, провайдера и endpoint.
 *
 * allowedModels в Plan.js хранит массив modelId из этой коллекции.
 * Проверка в checkSubscription использует строгое (exact) совпадение.
 *
 * endpointKey — имя LibreChat-эндпоинта, используемого при вызове модели:
 *   'openAI'      — стандартный OpenAI
 *   'anthropic'   — стандартный Anthropic
 *   'deepseek'    — custom-эндпоинт из librechat.yaml
 *   '<любое>'     — имя любого настроенного custom-эндпоинта
 */
const mongoose = require('mongoose');

const aiModelSchema = new mongoose.Schema(
  {
    modelId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    /** Имя LibreChat-эндпоинта (openAI / anthropic / deepseek / …) */
    endpointKey: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

/**
 * Дефолтные модели согласно требованиям сегментации тарифов.
 * seedDefaults идемпотентен — не перезаписывает существующие записи.
 */
const SEED_DEFAULTS = [
  { modelId: 'gpt-4o-mini',      provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-4o Mini'       },
  { modelId: 'claude-sonnet-4-6', provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Sonnet'     },
  { modelId: 'deepseek-chat',     provider: 'deepseek',  endpointKey: 'deepseek',  displayName: 'DeepSeek V3'       },
];

aiModelSchema.statics.seedDefaults = async function () {
  for (const def of SEED_DEFAULTS) {
    await this.findOneAndUpdate(
      { modelId: def.modelId },
      { $setOnInsert: { ...def, isActive: true } },
      { upsert: true },
    );
  }
};

module.exports = mongoose.model('AiModel', aiModelSchema);
