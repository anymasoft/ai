#!/usr/bin/env node
/**
 * Скрипт для очистки и реинициализации моделей в БД
 * Использование: node scripts/reset-models.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { AiModel, Plan } = require('../api/db/models');

async function resetModels() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/librechat';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Очищаем коллекцию AiModel
    await AiModel.deleteMany({});
    console.log('🗑️  Cleared AiModel collection');

    // Реинициализируем дефолтные модели
    await AiModel.seedDefaults();
    console.log('✅ Reseeded AiModel with defaults:');
    const models = await AiModel.find({});
    models.forEach(m => console.log(`   - ${m.modelId} (${m.displayName})`));

    // Проверим Plans
    const plans = await Plan.find({});
    console.log('\n✅ Plans configuration:');
    plans.forEach(p => {
      console.log(`   ${p.planId}: ${p.allowedModels.join(', ') || '(все модели)'}`);
    });

    console.log('\n✅ Done! БД очищена и переинициализирована.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

resetModels();
