'use strict';
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    externalPaymentId: { type: String, unique: true, required: true, index: true },
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packageId:  { type: String, required: true }, // pro | max
    /** 'subscription' — меняет план; 'token_pack' — только добавляет токены */
    type:       { type: String, enum: ['subscription', 'token_pack'], default: 'subscription' },
    /** Для subscription: 'pro' | 'business' */
    planPurchased: { type: String, default: null },
    tokenCredits:  { type: Number, required: true },
    amount:     { type: String, default: '' }, // '3990.00'
    status:     { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'succeeded' },
    /** Дата истечения подписки (заполняется при succeeded) */
    expiresAt:  { type: Date, default: null },
  },
  { timestamps: true },
);

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
