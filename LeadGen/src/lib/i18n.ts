import en from "@/i18n/en"
import ru from "@/i18n/ru"

export type Language = "en" | "ru"

export function getDict(lang: Language | undefined | null) {
  if (lang === "ru") return ru
  return en
}
