'use strict';
/**
 * TokenPackage — разовая докупка токенов.
 * Тип платежа: 'token_pack'. НЕ меняет plan и plan_expires_at.
 */
const mongoose = require('mongoose');

const tokenPackageSchema = new mongoose.Schema(
  {
    packageId:    { type: String, unique: true, required: true, index: true },
    label:        { type: String, required: true },
    priceRub:     { type: Number, required: true, min: 0 },
    tokenCredits: { type: Number, required: true, min: 0 },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SEED_DEFAULTS = [
  {
    packageId:    'token_pack',
    label:        'Пакет токенов',
    priceRub:     990,
    tokenCredits: 3_000_000,
    isActive:     true,
  },
];

/** Инициализирует дефолтные пакеты при первом запуске (идемпотентно). */
tokenPackageSchema.statics.seedDefaults = async function () {
  for (const def of SEED_DEFAULTS) {
    await this.findOneAndUpdate({ packageId: def.packageId }, { $setOnInsert: def }, { upsert: true });
  }
};

module.exports = mongoose.model('TokenPackage', tokenPackageSchema);
