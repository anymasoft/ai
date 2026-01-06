import React from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardClientWrapper } from "@/components/dashboard-client-wrapper";

/**
 * Dashboard Layout - Server Component
 * ЗАЩИТА: Проверяет session, неавторизованный → redirect на /
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Проверка авторизации на уровне layout
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Неавторизованный пользователь не может видеть дашборд
    redirect("/");
  }

  return (
    <DashboardClientWrapper>
      {children}
    </DashboardClientWrapper>
  );
}
