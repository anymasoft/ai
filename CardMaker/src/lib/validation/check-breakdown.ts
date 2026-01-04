/**
 * Результат отдельной проверки (для прозрачности оценки)
 */
export interface CheckResult {
  id: string // forbidden_words, grammar, requirements, etc
  name: string // "Запрещённые слова", "Грамматика", и т.д.
  weight: number // вес в % (сумма всех == 100)
  passed: boolean // прошла ли проверка
  penaltyApplied?: number // штраф в %, если не прошла
}

/**
 * Проблема, найденная при валидации
 * ШАГ 5: ТОЛЬКО 2 ТИПА ОШИБОК
 */
export interface ValidationIssue {
  type: 'forbidden_words' | 'marketplace_rule'
  severity: 'error' | 'warning'
  message: string
  suggestion?: string
}

/**
 * Сгенерировать breakdown проверок на основе найденных issues
 * Для прозрачности и объяснения итогового скора
 */
/**
 * ШАГ 5: ОБНОВЛЁННЫЙ BREAKDOWN
 *
 * Теперь ТОЛЬКО для 2 типов проверок:
 * - forbidden_words (50% веса)
 * - marketplace_rule (50% веса)
 */
export const generateCheckBreakdown = (issues: ValidationIssue[]): CheckResult[] => {
  // Категории проверок - ТОЛЬКО 2 НОВЫЕ
  const checkCategories: Record<string, { name: string; baseWeight: number }> = {
    forbidden_words: { name: 'Запрещённые слова', baseWeight: 50 },
    marketplace_rule: { name: 'Соответствие правилам маркетплейса', baseWeight: 50 },
  }

  // Объединяем категории по типам
  const checksByType = new Map<string, ValidationIssue[]>()
  for (const issue of issues) {
    if (!checksByType.has(issue.type)) {
      checksByType.set(issue.type, [])
    }
    checksByType.get(issue.type)!.push(issue)
  }

  // Генерируем результаты проверок
  const checks: CheckResult[] = []
  const totalWeight = Object.values(checkCategories).reduce((sum, cat) => sum + cat.baseWeight, 0)

  for (const [typeId, category] of Object.entries(checkCategories)) {
    const issuesForType = checksByType.get(typeId) || []
    const hasErrors = issuesForType.some((i) => i.severity === 'error')
    const hasWarnings = issuesForType.some((i) => i.severity === 'warning')

    const check: CheckResult = {
      id: typeId,
      name: category.name,
      weight: Math.round((category.baseWeight / totalWeight) * 100),
      passed: issuesForType.length === 0,
      penaltyApplied: undefined,
    }

    // Рассчитываем штраф если есть проблемы
    if (issuesForType.length > 0) {
      if (hasErrors) {
        check.penaltyApplied = Math.round(category.baseWeight * 0.8)
      } else if (hasWarnings) {
        check.penaltyApplied = Math.round(category.baseWeight * 0.4)
      }
    }

    checks.push(check)
  }

  return checks
}
