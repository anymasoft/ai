import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { AuthProvider } from "@/components/auth-provider";
import { MetrikaSpaHit } from "@/components/metrika-spa-hit";
import { Toaster } from "@/components/ui/sonner";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Помощник описаний товаров для ОЗОН и Wildberries",
  description: "Проверьте описание товара на соответствие требованиям маркетплейсов за 10 секунд. Найдите ошибки и исправьте перед публикацией.",
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

        <Script
          id="yandex-metrika"
          strategy="afterInteractive"
        >
          {`
            (function(m,e,t,r,i,k,a){
                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                for (var j = 0; j < document.scripts.length; j++) {
                    if (document.scripts[j].src === r) { return; }
                }
                k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
            })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

            ym(106161271, "init", {
                clickmap:true,
                trackLinks:true,
                accurateTrackBounce:true,
                webvisor:true
            });
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <Suspense fallback={null}>
          <MetrikaSpaHit />
        </Suspense>
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
