"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

// Alphanumeric + a spread of symbols. Kept intentionally small so glyph picks
// stay cache-friendly.
const DEFAULT_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+=/<>?[]{}§±";

export type MatrixRainProps = {
  /** Positioning/sizing classes. The canvas fills its box. */
  className?: string;
  /** Glyphs to sample from. */
  charset?: string;
  /** Body glyph colour. A `--css-var` name is resolved against :root. */
  color?: string;
  /** Leading ("head") glyph colour for depth. */
  headColor?: string;
  /** Glyph size in px. Also the column/row grid size. */
  fontSize?: number;
  /** Frame cap. Lower is cheaper; 24 reads as fluid rain. */
  fps?: number;
  /** Trail persistence, 0..1. Higher = longer, brighter trails. */
  trailOpacity?: number;
};

function resolveColor(value: string): string {
  if (typeof window === "undefined") return value;
  if (!value.startsWith("--")) return value;

  const resolved = getComputedStyle(document.documentElement).getPropertyValue(value).trim();
  return resolved || value;
}

/**
 * Lightweight canvas "matrix rain" surface. Optimised over the classic
 * setInterval snippet:
 *  - requestAnimationFrame with an fps cap (no wasted frames),
 *  - device-pixel-ratio scaling (crisp) capped at 2 (cheap),
 *  - typed arrays for per-column position/speed with organic variable speeds,
 *  - a brighter leading glyph for depth,
 *  - ResizeObserver-driven re-layout that preserves column state,
 *  - honours prefers-reduced-motion by painting a single static field,
 *  - full teardown on unmount.
 *
 * Purely decorative: aria-hidden and pointer-events-none. Reusable anywhere —
 * just give it a positioned box.
 */
export function MatrixRain({
  className,
  charset = DEFAULT_CHARSET,
  color = "--offpay-color-green",
  headColor = "--offpay-color-seasalt",
  fontSize = 14,
  fps = 24,
  trailOpacity = 0.09,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const context2d = canvasEl.getContext("2d");
    if (!context2d) return;

    // Fresh consts capture the non-null narrowed type so the nested render
    // closures below don't see them widened back to a nullable type.
    const canvas = canvasEl;
    const ctx = context2d;

    const chars = charset.length > 0 ? charset.split("") : ["0"];
    const bodyColor = resolveColor(color);
    const leadColor = resolveColor(headColor);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let columns = 0;
    let drops = new Float32Array(0);
    let speeds = new Float32Array(0);
    let rafId = 0;
    let lastFrame = 0;
    const frameInterval = 1000 / Math.max(1, fps);

    const randomChar = () => chars[(Math.random() * chars.length) | 0] ?? "0";
    const resetRow = () => -Math.floor(Math.random() * 24);

    function layout() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px var(--font-mono, ui-monospace, monospace)`;
      ctx.textBaseline = "top";

      const nextColumns = Math.ceil(width / fontSize);
      const nextDrops = new Float32Array(nextColumns);
      const nextSpeeds = new Float32Array(nextColumns);
      for (let i = 0; i < nextColumns; i += 1) {
        nextDrops[i] = i < drops.length ? drops[i]! : resetRow();
        nextSpeeds[i] = 0.45 + Math.random() * 0.85;
      }

      columns = nextColumns;
      drops = nextDrops;
      speeds = nextSpeeds;
      ctx.clearRect(0, 0, width, height);
    }

    function paint() {
      // Translucent wash fades prior glyphs into trails.
      ctx.fillStyle = `rgba(13, 14, 16, ${trailOpacity})`;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < columns; i += 1) {
        const x = i * fontSize;
        const y = drops[i]! * fontSize;

        if (y >= 0) {
          ctx.fillStyle = bodyColor;
          ctx.fillText(randomChar(), x, y - fontSize);
          ctx.fillStyle = leadColor;
          ctx.fillText(randomChar(), x, y);
        }

        drops[i]! += speeds[i]!;
        if (y > height && Math.random() > 0.975) drops[i] = resetRow();
      }
    }

    function loop(time: number) {
      rafId = requestAnimationFrame(loop);
      if (time - lastFrame < frameInterval) return;
      lastFrame = time;
      paint();
    }

    layout();

    if (reduceMotion) {
      // Single static field: seed rows and paint once, no animation loop.
      for (let i = 0; i < columns; i += 1) drops[i] = Math.random() * (height / fontSize);
      paint();
    } else {
      rafId = requestAnimationFrame(loop);
    }

    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(layout);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
    };
  }, [charset, color, headColor, fontSize, fps, trailOpacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none block h-full w-full", className)}
    />
  );
}
