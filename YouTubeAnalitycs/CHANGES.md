# Changes

This file is intentionally kept minimal.
All changes are tracked in git history.

---

## 2025-12-12 - Глобальное хранилище состояния генерации аналитики (Generation Status Store)

### Проблема
Состояние кнопок генерации аналитики теряется при collapse/unmount компонентов, что приводит к:
- Потере статуса загрузки при сворачивании секции
- Возможности повторного запуска генерации, уже находящейся в процессе
- Дублированию задач на бэкенде

### Решение
Создан глобальный Zustand store для надежного хранения состояния генерации:
- **Новый файл:** `src/store/generationStatusStore.ts` - глобальное хранилище состояния
- **Тип:** `GenerationStatus = "idle" | "loading" | "success" | "error"`
- **Ключ состояния:** `${competitorId}:${sectionType}` - уникален на связку компонента и компетитора

### Обновленные компоненты
1. **ContentIntelligenceBlock.tsx** - теперь использует store для состояния загрузки
2. **MomentumInsights.tsx** - переведён на глобальное состояние
3. **DeepCommentAnalysis.tsx** - состояние синхронизировано через store
4. **AudienceInsights.tsx** - обновлён для использования глобального store
5. **DeepAudienceAnalysis.tsx** - состояние генерации в глобальном хранилище
6. **CommentInsights.tsx** - заменён на useGenerationStatusStore

### Гарантии архитектуры
- ✅ Состояние НЕ теряется при collapse/unmount
- ✅ Невозможно запустить дублирующиеся задачи
- ✅ Состояние уникально для каждого компонента и компетитора
- ✅ Полная совместимость с существующими API endpoints
- ✅ Не требуются изменения в backend
- ✅ Масштабируется на новые типы анализа
