import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход в CardMaker",
  description: "Войдите в аккаунт и начните проверять описания товаров для маркетплейсов. Валидируйте тексты за 10 секунд.",
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
