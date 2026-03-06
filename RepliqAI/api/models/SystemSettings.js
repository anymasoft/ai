'use strict';
/**
 * SystemSettings — глобальные настройки системы
 * Хранит single-record документы с системными флагами и параметрами.
 *
 * Примеры:
 * - debugModelUsage: boolean - показывать ли debug информацию о модели и расходе токенов
 * - ...другие настройки по мере расширения
 */
const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

/**
 * Получить значение настройки по ключу.
 * Если не найдена — вернуть дефолтное значение.
 */
systemSettingsSchema.statics.getValue = async function (key, defaultValue = null) {
  const setting = await this.findOne({ key }).lean();
  return setting?.value ?? defaultValue;
};

/**
 * Установить значение настройки по ключу.
 * Создаст новую запись, если не существует.
 */
systemSettingsSchema.statics.setValue = async function (key, value, description = null) {
  return this.findOneAndUpdate(
    { key },
    { value, description, $set: { updatedAt: new Date() } },
    { upsert: true, new: true },
  );
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
