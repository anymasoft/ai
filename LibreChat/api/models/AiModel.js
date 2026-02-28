'use strict';
/**
 * AiModel — каталог доступных AI-моделей.
 * Единственный источник истины для списка моделей, их displayName и провайдера.
 *
 * allowedModels в Plan.js хранит массив modelId из этой коллекции.
 * Проверка в checkSubscription использует строгое (exact) совпадение.
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
 * Дефолтные модели соответствуют активной конфигурации в librechat.yaml.
 * seedDefaults идемпотентен — не перезаписывает существующие записи.
 */
const SEED_DEFAULTS = [
  { modelId: 'gpt-4o-mini',               provider: 'openai',    displayName: 'GPT-4o Mini'   },
  { modelId: 'claude-sonnet-4-5-20250929', provider: 'anthropic', displayName: 'Claude Sonnet' },
  { modelId: 'deepseek-chat',              provider: 'deepseek',  displayName: 'DeepSeek V3'   },
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
