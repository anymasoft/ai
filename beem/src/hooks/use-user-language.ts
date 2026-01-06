"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Language } from "@/lib/i18n"

export function useUserLanguage(): Language {
  const { data: session } = useSession()
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    if (session?.user?.id) {
      // Получаем язык пользователя из API
      fetch("/api/user/language")
        .then((res) => res.json())
        .then((data) => {
          if (data.language) {
            setLanguage(data.language as Language)
          }
        })
        .catch((error) => {
          console.error("Failed to fetch user language:", error)
        })
    }
  }, [session?.user?.id])

  return language
}
