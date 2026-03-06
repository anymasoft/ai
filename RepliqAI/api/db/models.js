const mongoose = require('mongoose');
const { createModels } = require('@librechat/data-schemas');
const models = createModels(mongoose);

// ✅ Добавляем локальные модели которые не в @librechat/data-schemas
const AiModel = require('../models/AiModel');

module.exports = { ...models, AiModel };
