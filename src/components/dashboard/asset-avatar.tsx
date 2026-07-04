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

export function AssetAvatar({
  logo,
  name,
}: {
  logo: string | null | undefined;
  name: string;
  symbol?: string;
}) {
  const [failed, setFailed] = useState(false);
  const logoUrl = failed ? null : readDisplayLogoUrl(logo);

  if (!logoUrl) {
    return <span className="h-10 w-10 shrink-0" aria-hidden="true" />;
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
