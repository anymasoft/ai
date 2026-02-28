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
    allowedModels: ['gpt-4o-mini'],
    isActive: true,
  },
  {
    planId: 'pro',
    label: 'Pro',
    priceRub: 3_990,
    tokenCreditsOnPurchase: 5_000_000,
    durationDays: 30,
    allowedModels: [],
    isActive: true,
  },
  {
    planId: 'business',
    label: 'Business',
    priceRub: 9_990,
    tokenCreditsOnPurchase: 12_000_000,
    durationDays: 30,
    allowedModels: [],
    isActive: true,
  },
];

/** Инициализирует дефолтные планы при первом запуске (идемпотентно). */
planSchema.statics.seedDefaults = async function () {
  for (const def of SEED_DEFAULTS) {
    await this.findOneAndUpdate({ planId: def.planId }, { $setOnInsert: def }, { upsert: true });
  }
};

module.exports = mongoose.model('Plan', planSchema);
