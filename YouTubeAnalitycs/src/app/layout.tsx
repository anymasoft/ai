import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Сценарии и идеи для YouTube — рост просмотров канала",
  description: "Сервис подбора идей и сценариев для YouTube на основе успешных видео конкурентов и трендов.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (!window.ethereum) {
                window.ethereum = {
                  isFake: true,
                  isMetaMask: false,
                  request: () => Promise.reject(new Error("MetaMask is disabled for this site")),
                  on() {},
                  removeListener() {}
                };
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider defaultTheme="system" storageKey="nextjs-ui-theme">
            <SidebarConfigProvider>
              {children}
            </SidebarConfigProvider>
          </ThemeProvider>
        </AuthProvider>
        <Toaster closeButton position="top-right" />
      </body>
    </html>
  );
}
