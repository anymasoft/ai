import React from "react";
import { DashboardClientWrapper } from "@/components/dashboard-client-wrapper";

/**
 * Dashboard Layout - Server Component
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardClientWrapper>
      {children}
    </DashboardClientWrapper>
  );
}
