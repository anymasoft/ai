"use client"

import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface ConfigMissingNoticeProps {
  missing: string[]
  adminLink?: string
}

/**
 * Компонент для отображения уведомления об отсутствии конфигурации
 * Показывается если отсутствуют критичные элементы (промпты, правила, стоп-слова и т.д.)
 */
export function ConfigMissingNotice({ missing, adminLink = "/dashboard/admin/system-prompts" }: ConfigMissingNoticeProps) {
  if (!missing || missing.length === 0) {
    return null
  }

  const missingLabels: Record<string, string> = {
    gen_base: "Промпт для генерации",
    validate_base: "Промпт для проверки",
    marketplace_rules: "Правила маркетплейсов",
    stop_words: "Стоп-слова",
    styles: "Стили описаний",
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-semibold mb-2">⚠️ Сервис не полностью настроен</p>
        <p className="text-sm mb-3">Отсутствуют критичные элементы конфигурации:</p>
        <ul className="list-disc list-inside text-sm space-y-1 mb-3">
          {missing.map((key) => (
            <li key={key}>{missingLabels[key] || key}</li>
          ))}
        </ul>
        <p className="text-sm">
          Пожалуйста, обратитесь к{" "}
          <Link href={adminLink} className="underline hover:no-underline font-medium">
            администратору
          </Link>
          {" "}для настройки конфигурации.
        </p>
      </AlertDescription>
    </Alert>
  )
}
