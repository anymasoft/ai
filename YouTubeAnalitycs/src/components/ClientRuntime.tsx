"use client";

import { useEffect } from "react";
import { suppressMetaMaskErrors } from "@/lib/suppress-metamask-errors";

/**
 * ClientRuntime компонент
 *
 * Инициализирует клиентскую runtime логику:
 * - Подавление MetaMask ошибок в консоли
 * - Другие глобальные клиентские настройки (при необходимости)
 *
 * Должен быть добавлен в root layout.tsx
 */
export function ClientRuntime() {
  useEffect(() => {
    // Инициализируем подавление MetaMask ошибок
    suppressMetaMaskErrors();

    // Здесь можно добавить другие runtime инициализации
    // Например: аналитику, feature flags, etc.
  }, []);

  // Этот компонент не рендерит ничего - только side effects
  return null;
}
