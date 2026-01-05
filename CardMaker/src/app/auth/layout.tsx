import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход в Beem",
  description: "Войдите в аккаунт и проверяйте описания товаров для Ozon и Wildberries перед публикацией.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
