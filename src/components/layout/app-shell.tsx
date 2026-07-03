import type { ReactNode } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { GlobalNavbar } from "@/components/navigation/global-navbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-app-gradient h-dvh min-h-dvh overflow-hidden overscroll-none text-foreground">
      <div className="flex h-full min-h-0 w-full flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-4">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <GlobalNavbar />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 py-5 md:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
