import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход в CardMaker",
  description: "Войдите в аккаунт и получите идеи и сценарии для создания описаний товаров, которые помогают расти просмотрам.",
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
