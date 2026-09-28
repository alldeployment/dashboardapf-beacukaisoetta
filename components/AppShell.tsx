"use client";

import { usePathname } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
