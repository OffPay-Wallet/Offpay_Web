import type { ReactNode } from "react";

import { FloatingTabNav } from "@/components/navigation/floating-tab-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-32 pt-5 md:px-6 lg:px-8">
        {children}
      </div>
      <FloatingTabNav />
    </main>
  );
}
