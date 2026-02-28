const mongoose = require('mongoose');
const { createModels } = require('@librechat/data-schemas');
const Payment = require('~/models/Payment');
const Subscription = require('~/models/Subscription');
const models = createModels(mongoose);

module.exports = { ...models, Payment, Subscription };
