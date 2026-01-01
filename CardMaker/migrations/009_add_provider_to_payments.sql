-- Добавление колонки provider к таблице payments для отслеживания способа оплаты (yookassa, manual, free)
ALTER TABLE payments ADD COLUMN provider TEXT DEFAULT 'yookassa';
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);
