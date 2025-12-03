import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "YouTube Analytics",
  description: "Analytics platform for YouTube creators and marketers",
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
              try {
                window.ethereum = undefined;
                window.web3 = undefined;
              } catch (e) {}
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
