import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "AI-сценарист для YouTube",
  description: "Подбираем темы и сценарии для YouTube-видео, которые уже доказали рост просмотров у конкурентов",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Применение темы до первого рендеринга, чтобы избежать FOUC
              (function() {
                const storageKey = "nextjs-ui-theme";
                const stored = localStorage.getItem(storageKey);
                let theme = stored || "system";

                if (theme === "system") {
                  theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                }

                document.documentElement.classList.remove("light", "dark");
                document.documentElement.classList.add(theme);
              })();

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
