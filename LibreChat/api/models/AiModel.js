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
 * Дефолтные модели - полный каталог доступных моделей.
 * seedDefaults идемпотентен — не перезаписывает существующие записи.
 *
 * Доступные модели в каждом плане определяются в Plan.js (allowedModels).
 * Селектор фильтрует эти модели по плану пользователя.
 */
const SEED_DEFAULTS = [
  // ═══════════════════════════════════════════════════════
  // OpenAI Models
  // ═══════════════════════════════════════════════════════
  { modelId: 'gpt-4o',                    provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-4o'                      },
  { modelId: 'gpt-4o-mini',               provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-4o Mini'                 },
  { modelId: 'gpt-4.1-mini',              provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-4.1 Mini'                },
  { modelId: 'gpt-4-turbo',               provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-4 Turbo'                 },
  { modelId: 'gpt-4',                     provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-4'                       },
  { modelId: 'gpt-3.5-turbo',             provider: 'openai',    endpointKey: 'openAI',    displayName: 'GPT-3.5 Turbo'               },

  // ═══════════════════════════════════════════════════════
  // Anthropic Models
  // ═══════════════════════════════════════════════════════
  { modelId: 'claude-sonnet-4-6',         provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Sonnet 4.6'            },
  { modelId: 'claude-opus-4-6',           provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Opus 4.6'              },
  { modelId: 'claude-haiku-3-5',          provider: 'anthropic', endpointKey: 'anthropic', displayName: 'Claude Haiku 3.5'             },

  // ═══════════════════════════════════════════════════════
  // DeepSeek Models
  // ═══════════════════════════════════════════════════════
  { modelId: 'deepseek-chat',             provider: 'deepseek',  endpointKey: 'deepseek',  displayName: 'DeepSeek Chat'               },
  { modelId: 'deepseek-reasoner',         provider: 'deepseek',  endpointKey: 'deepseek',  displayName: 'DeepSeek Reasoner'           },

  // ═══════════════════════════════════════════════════════
  // Google Models (если настроены)
  // ═══════════════════════════════════════════════════════
  { modelId: 'gemini-2.0-flash',          provider: 'google',    endpointKey: 'google',    displayName: 'Gemini 2.0 Flash'            },
  { modelId: 'gemini-1.5-pro',            provider: 'google',    endpointKey: 'google',    displayName: 'Gemini 1.5 Pro'              },

  // ═══════════════════════════════════════════════════════
  // Groq Models (если настроены)
  // ═══════════════════════════════════════════════════════
  { modelId: 'llama-3.1-70b-versatile',   provider: 'groq',      endpointKey: 'groq',      displayName: 'Llama 3.1 70B Versatile'     },
  { modelId: 'mixtral-8x7b-32768',        provider: 'groq',      endpointKey: 'groq',      displayName: 'Mixtral 8x7B'                },
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
