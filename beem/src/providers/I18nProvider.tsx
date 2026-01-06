"use client"

import { createContext, useContext, ReactNode } from "react"
import { getDict, Language } from "@/lib/i18n"
import en from "@/i18n/en"

type Dict = typeof en

interface I18nContextValue {
  lang: Language
  dict: Dict
}

const I18nContext = createContext<I18nContextValue | null>(null)

interface I18nProviderProps {
  lang: Language
  children: ReactNode
}

export function I18nProvider({ lang, children }: I18nProviderProps) {
  const dict = getDict(lang)

  return (
    <I18nContext.Provider value={{ lang, dict }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return context
}
