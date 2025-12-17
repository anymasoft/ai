"use client";

import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
// import { ThemeCustomizer, ThemeCustomizerTrigger } from "@/components/theme-customizer";
import { UpgradeToProButton } from "@/components/upgrade-to-pro-button";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { Suspense } from "react";

interface DashboardClientWrapperProps {
  children: React.ReactNode;
}

/**
 * Client-side wrapper для dashboard layout
 * Содержит всю client логику: useState, hooks, интерактивность
 */
export function DashboardClientWrapper({ children }: DashboardClientWrapperProps) {
  const [themeCustomizerOpen, setThemeCustomizerOpen] = React.useState(false);
  const { config } = useSidebarConfig();

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div></div></div>}>
      <SidebarProvider
        style={{
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties}
        className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
      >
        {config.side === "left" ? (
          <>
            <AppSidebar
              variant={config.variant}
              collapsible={config.collapsible}
              side={config.side}
            />
            <SidebarInset>
              <SiteHeader />
              <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                    <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="animate-spin">Загрузка...</div></div>}>
                      {children}
                    </Suspense>
                  </div>
                </div>
              </div>
              <SiteFooter />
            </SidebarInset>
          </>
        ) : (
          <>
            <SidebarInset>
              <SiteHeader />
              <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                    <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="animate-spin">Загрузка...</div></div>}>
                      {children}
                    </Suspense>
                  </div>
                </div>
              </div>
              <SiteFooter />
            </SidebarInset>
            <AppSidebar
              variant={config.variant}
              collapsible={config.collapsible}
              side={config.side}
            />
          </>
        )}

        {/* Theme Customizer */}
//         <ThemeCustomizerTrigger onClick={() => setThemeCustomizerOpen(true)} />
//         <ThemeCustomizer
          open={themeCustomizerOpen}
          onOpenChange={setThemeCustomizerOpen}
        />
        <UpgradeToProButton />
      </SidebarProvider>
    </Suspense>
  );
}
