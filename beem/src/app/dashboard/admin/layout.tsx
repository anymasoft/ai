import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ADMIN_EMAIL } from "@/lib/admin-config";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ЧАСТЬ 1: Проверка авторизации
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  // ЧАСТЬ 2: Проверка admin статуса
  if (session.user.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  // Пользователь авторизован и админ - рендерим детей
  return <>{children}</>;
}
