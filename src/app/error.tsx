"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden="true" />
          <div className="space-y-2">
            <h1 className="text-base font-semibold">Could not load Offpay Web</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {error.message || "Refresh the route or retry the last action."}
            </p>
          </div>
        </div>
        <Button type="button" className="mt-5 w-full" onClick={reset}>
          Try again
        </Button>
      </section>
    </main>
  );
}
