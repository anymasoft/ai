'use strict';
/**
 * Модель подписки пользователя.
 * Хранит план (plan), дату начала и окончания — отдельно от баланса токенов.
 *
 * Если запись отсутствует — пользователь считается на плане 'free'.
 */
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    /** Активный план: 'free' | 'pro' | 'business' */
    plan: {
      type: String,
      enum: ['free', 'pro', 'business'],
      default: 'free',
    },
    /** Дата активации текущего плана */
    planStartedAt: {
      type: Date,
      default: null,
    },
    /**
     * Дата истечения плана.
     * null → план бессрочный (free) или не задан.
     * После истечения checkSubscription middleware автоматически переводит
     * пользователя обратно на free. Токены при этом НЕ сгорают.
     */
    planExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;
