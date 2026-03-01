'use strict';
/**
 * Plan — конфигурация тарифного плана (хранится в БД).
 * Единственный источник истины для цен, токенов и списка моделей.
 *
 * allowedModels:
 *   [] (пустой массив)                = все модели разрешены
 *   ['gpt-4o-mini', 'deepseek-chat']  = строгий список точных modelId из коллекции AiModel
 *
 * ВАЖНО: только точные modelId (exact match). Паттерны и подстроки ЗАПРЕЩЕНЫ.
 * Управление через /api/admin/mvp/plans/:planId — валидация против AiModel.
 */
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    planId:                { type: String, enum: ['free', 'pro', 'business'], unique: true, required: true, index: true },
    label:                 { type: String, required: true },
    priceRub:              { type: Number, required: true, default: 0, min: 0 },
    tokenCreditsOnPurchase:{ type: Number, required: true, default: 0, min: 0 },
    durationDays:          { type: Number, default: null },
    allowedModels:         { type: [String], default: [] },
    isActive:              { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SEED_DEFAULTS = [
  {
    planId: 'free',
    label: 'Free',
    priceRub: 0,
    tokenCreditsOnPurchase: 0,
    durationDays: null,
    // Free план: только экономичные модели
    allowedModels: [
      'gpt-4o-mini',      // OpenAI
      'gpt-3.5-turbo',    // OpenAI (старая, дешёвая)
    ],
    isActive: true,
  },
  {
    planId: 'pro',
    label: 'Pro',
    priceRub: 3_990,
    tokenCreditsOnPurchase: 5_000_000,
    durationDays: 30,
    // Pro план: основные модели
    allowedModels: [
      'gpt-4o',               // OpenAI (лучшая)
      'gpt-4o-mini',          // OpenAI
      'gpt-4.1-mini',         // OpenAI (альтернатива)
      'gpt-4-turbo',          // OpenAI
      'claude-sonnet-4-6',    // Anthropic
      'claude-haiku-4-5',     // Anthropic (бюджетная) - ИСП. ИСТИНА: AiModel.js
      'deepseek-chat',        // DeepSeek
    ],
    isActive: true,
  },
  {
    planId: 'business',
    label: 'Business',
    priceRub: 9_990,
    tokenCreditsOnPurchase: 12_000_000,
    durationDays: 30,
    // Business план: ВСЕ модели
    allowedModels: [
      'gpt-4o',                       // OpenAI
      'gpt-4o-mini',                  // OpenAI
      'gpt-4.1-mini',                 // OpenAI
      'gpt-4-turbo',                  // OpenAI
      'gpt-4',                        // OpenAI
      'gpt-3.5-turbo',                // OpenAI
      'gpt-5.2',                      // OpenAI
      'claude-sonnet-4-6',            // Anthropic
      'claude-opus-4-6',              // Anthropic
      'claude-haiku-4-5',             // Anthropic - ИСП. ИСТИНА: AiModel.js
      'deepseek-chat',                // DeepSeek
      'deepseek-reasoner',            // DeepSeek
      'gemini-2.0-flash',             // Google
      'gemini-1.5-pro',               // Google
      'llama-3.1-70b-versatile',      // Groq
      'mixtral-8x7b-32768',           // Groq
    ],
    isActive: true,
  },
];

/** Инициализирует дефолтные планы при первом запуске (идемпотентно). */
planSchema.statics.seedDefaults = async function () {
  for (const def of SEED_DEFAULTS) {
    // ВАЖНО: Используем $setOnInsert для allowedModels (только при создании документа)
    // и $set для остальных полей (всегда обновлять цены, токены и статус)
    // Это предотвращает перезапись пользовательских изменений allowedModels
    await this.findOneAndUpdate(
      { planId: def.planId },
      {
        $set: {
          label: def.label,
          priceRub: def.priceRub,
          tokenCreditsOnPurchase: def.tokenCreditsOnPurchase,
          durationDays: def.durationDays,
          isActive: def.isActive,
        },
        $setOnInsert: {
          allowedModels: def.allowedModels,
        },
      },
      { upsert: true, new: true }
    );
  }
};

module.exports = mongoose.model('Plan', planSchema);
