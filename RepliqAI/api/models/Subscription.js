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

/**
 * ✅ Pre-save hook: Normalize plan to lowercase
 * Ensures plan is always stored in lowercase regardless of input
 * Prevents: "Business" → "business", "BUSINESS" → "business", etc.
 */
subscriptionSchema.pre('save', function (next) {
  if (this.plan && typeof this.plan === 'string') {
    const normalized = this.plan.toLowerCase();
    if (!['free', 'pro', 'business'].includes(normalized)) {
      const err = new Error(
        `Invalid plan value: "${this.plan}". Must be one of: free, pro, business`,
      );
      err.name = 'ValidationError';
      return next(err);
    }

    // 📝 Log if normalization occurred
    if (this.plan !== normalized) {
      const { logger } = require('@librechat/data-schemas');
      logger.info('[SUBSCRIPTION PLAN DEBUG] Normalizing plan on save', {
        userId: this.userId,
        original: this.plan,
        normalized,
      });
      this.plan = normalized;
    } else {
      this.plan = normalized; // Ensure it's lowercase even if already correct
    }
  }
  next();
});

/**
 * Pre-findOneAndUpdate hook: Normalize plan in update operations
 * Ensures plan is normalized even when using updateOne/findOneAndUpdate
 */
subscriptionSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();

  // Handle both direct $set and nested updates
  let planValue = update.plan || (update.$set && update.$set.plan);

  if (planValue && typeof planValue === 'string') {
    const normalized = planValue.toLowerCase();
    if (!['free', 'pro', 'business'].includes(normalized)) {
      const err = new Error(
        `Invalid plan value: "${planValue}". Must be one of: free, pro, business`,
      );
      err.name = 'ValidationError';
      return next(err);
    }

    // 📝 Log if normalization occurred
    if (planValue !== normalized) {
      const { logger } = require('@librechat/data-schemas');
      logger.info('[SUBSCRIPTION PLAN DEBUG] Normalizing plan in findOneAndUpdate', {
        original: planValue,
        normalized,
      });
    }

    // Update both possible locations
    if (update.$set) {
      update.$set.plan = normalized;
    } else {
      update.plan = normalized;
    }
  }

  next();
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;
