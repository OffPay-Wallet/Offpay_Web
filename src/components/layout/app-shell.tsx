import type { ReactNode } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { GlobalNavbar } from "@/components/navigation/global-navbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <GlobalNavbar />
          <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
