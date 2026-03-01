const mongoose = require('mongoose');
const { createModels } = require('@librechat/data-schemas');
const Payment = require('~/models/Payment');
const Subscription = require('~/models/Subscription');
const Plan = require('~/models/Plan');
const TokenPackage = require('~/models/TokenPackage');
const AiModel = require('~/models/AiModel');
const SystemSettings = require('~/models/SystemSettings');
const models = createModels(mongoose);

module.exports = { ...models, Payment, Subscription, Plan, TokenPackage, AiModel, SystemSettings };
