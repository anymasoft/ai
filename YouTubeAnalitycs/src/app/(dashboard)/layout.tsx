import React from "react";
import { I18nProvider } from "@/providers/I18nProvider";
import { getUserLanguageServer } from "@/lib/get-user-language-server";
import { DashboardClientWrapper } from "@/components/dashboard-client-wrapper";

/**
 * Dashboard Layout - Server Component
 * Получает язык пользователя на сервере и передает в I18nProvider
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Получаем язык пользователя на сервере (без лишних client запросов)
  const language = await getUserLanguageServer();

  return (
    <I18nProvider lang={language}>
      <DashboardClientWrapper>
        {children}
      </DashboardClientWrapper>
    </I18nProvider>
  );
}
