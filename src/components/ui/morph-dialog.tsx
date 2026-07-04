"use client";

import { animate } from "motion";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type FlipValues = { x: number; y: number; scaleX: number; scaleY: number };

/**
 * FLIP values (center-based translate + scale) that place `target` visually at
 * `origin`. Animating these back to identity morphs the panel out of the
 * trigger's rect.
 */
function flipValues(origin: DOMRect | null | undefined, target: DOMRect): FlipValues {
  if (!origin || target.width === 0 || target.height === 0) {
    return { x: 0, y: 0, scaleX: 0.94, scaleY: 0.94 };
  }

  return {
    x: origin.left + origin.width / 2 - (target.left + target.width / 2),
    y: origin.top + origin.height / 2 - (target.top + target.height / 2),
    scaleX: Math.max(origin.width / target.width, 0.05),
    scaleY: Math.max(origin.height / target.height, 0.05),
  };
}

/**
 * Reusable modal that springs open by morphing from a trigger element's rect
 * and closes with a fade, powered by `motion` (Framer Motion). The morph origin
 * is read from the `originRect` prop inside the enter layout effect so the very
 * first open animates correctly (no default-animation-then-fix on 2nd click).
 */
export function MorphDialog({
  ariaLabel,
  children,
  className,
  onClose,
  open,
  originRect,
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
  open: boolean;
  originRect?: DOMRect | null;
}) {
  const [active, setActive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Opening mounts the portal immediately; closing is driven by the exit
  // animation below, so we never setState synchronously inside an effect.
  if (open && !active) {
    setActive(true);
  }

  // Enter: spring-morph from the trigger rect. Reads `originRect` directly so
  // the first open has the correct origin.
  useIsomorphicLayoutEffect(() => {
    if (!active || !open) return;
    const panel = panelRef.current;
    if (!panel) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panel.focus({ preventScroll: true });

    const backdrop = backdropRef.current;

    if (prefersReducedMotion()) {
      panel.style.opacity = "1";
      if (backdrop) backdrop.style.opacity = "1";
      return;
    }

    const target = panel.getBoundingClientRect();
    const { x, y, scaleX, scaleY } = flipValues(originRect, target);

    const controls = animate(
      panel,
      { x: [x, 0], y: [y, 0], scaleX: [scaleX, 1], scaleY: [scaleY, 1], opacity: [0, 1] },
      {
        default: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
        opacity: { duration: 0.28, ease: "easeOut" },
      },
    );
    if (backdrop) {
      animate(backdrop, { opacity: [0, 1] }, { duration: 0.28, ease: "easeOut" });
    }

    return () => controls.stop();
  }, [active, open, originRect]);

  // Exit: fade out (no morph), then unmount.
  useEffect(() => {
    if (open || !active) return;

    const finish = () => {
      setActive(false);
      restoreFocusRef.current?.focus?.();
    };

    const panel = panelRef.current;
    if (!panel) {
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }

    const duration = prefersReducedMotion() ? 0 : 0.22;
    const backdrop = backdropRef.current;

    animate(panel, { opacity: [1, 0] }, { duration, ease: "easeIn", onComplete: finish });
    if (backdrop) {
      animate(backdrop, { opacity: [1, 0] }, { duration, ease: "easeIn" });
    }

    return undefined;
  }, [open, active]);

  // Escape to close + body scroll lock while active.
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [active, onClose]);

  if (!active) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Clicking anywhere on the backdrop (i.e. outside the panel) closes. */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 opacity-0 backdrop-blur-sm"
        aria-hidden="true"
        onPointerDown={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{ opacity: 0 }}
        className={cn(
          "relative z-[1] max-h-[88vh] w-full overflow-y-auto outline-none",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
