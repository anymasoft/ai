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
 * ВАЖНО: modelId должен точно совпадать с идентификатором API провайдера:
 *   Anthropic: claude-sonnet-4-6, claude-opus-4-6
 *   OpenAI:    gpt-4.1-mini
 *   DeepSeek:  deepseek-chat, deepseek-reasoner
 */
const SEED_DEFAULTS = [
  { modelId: 'gpt-4.1-mini',      provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-4.1 Mini'      },
  { modelId: 'gpt-5.2',           provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-5.2'           },
  { modelId: 'claude-sonnet-4-6', provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Sonnet 4.6' },
  { modelId: 'claude-opus-4-6',   provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Opus 4.6'   },
  { modelId: 'deepseek-chat',     provider: 'deepseek',  endpointKey: 'deepseek',  displayName: 'DeepSeek V3'       },
  { modelId: 'deepseek-reasoner', provider: 'deepseek',  endpointKey: 'deepseek',  displayName: 'DeepSeek R2'       },
];

/**
 * Неверные modelId (перепутан порядок слов) → правильные.
 * Выполняется автоматически при каждом вызове seedDefaults() — идемпотентно.
 */
const LEGACY_RENAMES = [
  { from: 'claude-4-6-sonnet', to: 'claude-sonnet-4-6', provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Sonnet 4.6' },
  { from: 'claude-4-6-opus',   to: 'claude-opus-4-6',   provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Opus 4.6'   },
];

aiModelSchema.statics.seedDefaults = async function () {
  // 1. Мигрируем старые неверные modelId на правильные
  for (const { from, to, ...fields } of LEGACY_RENAMES) {
    const old = await this.findOne({ modelId: from }).lean();
    if (!old) continue;
    // Создаём запись с правильным ID (только если ещё не существует)
    await this.findOneAndUpdate(
      { modelId: to },
      { $setOnInsert: { modelId: to, ...fields, isActive: old.isActive } },
      { upsert: true },
    );
    // Удаляем старую запись с неверным ID
    await this.deleteOne({ modelId: from });
  }

  // 2. Добавляем дефолтные модели (только если не существуют)
  for (const def of SEED_DEFAULTS) {
    await this.findOneAndUpdate(
      { modelId: def.modelId },
      { $setOnInsert: { ...def, isActive: true } },
      { upsert: true },
    );
  }
};

module.exports = mongoose.model('AiModel', aiModelSchema);
