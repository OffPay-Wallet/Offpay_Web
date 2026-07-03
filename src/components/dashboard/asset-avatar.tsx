"use client";

import Image from "next/image";
import { useState } from "react";

const passthroughImageLoader = ({ src }: { src: string }) => src;

function readDisplayLogoUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function initials(symbol: string | undefined, name: string): string {
  const base = (symbol ?? name ?? "").trim();
  return base.slice(0, 2).toUpperCase() || "?";
}

export function AssetAvatar({
  logo,
  name,
  symbol,
}: {
  logo: string | null | undefined;
  name: string;
  symbol?: string;
}) {
  const [failed, setFailed] = useState(false);
  const logoUrl = failed ? null : readDisplayLogoUrl(logo);

  // When the API provides no logo (common on devnet) or the image fails to
  // load, fall back to a symbol-initials chip so the row never shows a gap.
  if (!logoUrl) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground"
        aria-hidden="true"
      >
        {initials(symbol, name)}
      </span>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`${name} logo`}
      width={40}
      height={40}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
      loader={passthroughImageLoader}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
