'use strict';
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    externalPaymentId: { type: String, unique: true, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packageId: { type: String, required: true }, // starter | pro | max
    tokenCredits: { type: Number, required: true },
    amount: { type: String, default: '' }, // '990.00'
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'succeeded' },
  },
  { timestamps: true },
);

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
