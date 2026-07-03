import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="bg-app-gradient flex min-h-screen items-center justify-center p-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-5 text-card-foreground">
        <h1 className="text-base font-semibold">Route not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This Offpay Web surface has not been registered yet.
        </p>
        <Link href="/" className={cn(buttonVariants({ variant: "primary" }), "mt-5 w-full")}>
          Return to workspace
        </Link>
      </section>
    </main>
  );
}
