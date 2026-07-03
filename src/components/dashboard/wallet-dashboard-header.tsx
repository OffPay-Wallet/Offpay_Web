"use client";

import { useEffect, useState } from "react";

import { getLocalGreeting, type LocalGreeting } from "@/lib/offpay/local-greeting";

export function WalletDashboardHeader({
  assetCount,
  loading,
}: {
  assetCount: number;
  loading: boolean;
}) {
  const [greeting, setGreeting] = useState<LocalGreeting>("Good morning");
  const assetLabel = assetCount === 1 ? "asset" : "assets";
  const summary = loading
    ? "Loading asset holdings"
    : `You have ${assetCount} ${assetLabel} holding`;

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getLocalGreeting());
    };

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <header className="font-sans">
      <h1 className="text-2xl font-semibold leading-tight text-foreground">
        {greeting}
      </h1>
      <p className="mt-1 text-sm font-semibold leading-5 text-muted-foreground">
        {summary}
      </p>
    </header>
  );
}
