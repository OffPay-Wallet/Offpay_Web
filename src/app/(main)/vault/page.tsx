import { MatrixRain } from "@/components/ui/matrix-rain";
import { UmbraVaultPanel } from "@/components/umbra/umbra-vault-panel";

export default function VaultPage() {
  return (
    <div className="relative isolate min-h-full">
      {/* Full-screen ambient matrix-rain overlay. The canvas is transparent
          except for the glyphs, so the normal app background shows through. It
          sits behind the page content (and the opaque navbar/sidebar chrome). */}
      <MatrixRain
        className="fixed inset-0 -z-10 opacity-60"
        fontSize={15}
        fps={20}
      />

      {/* Title shares the card's centered column so it aligns to the card's left
          edge. A layered text-shadow gives a dark backdrop + soft glow so it
          stays legible over the matrix rain. */}
      <div className="mx-auto mb-5 w-full max-w-lg">
        <h1 className="w-fit text-3xl font-bold leading-tight tracking-tight md:text-4xl [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_26px_rgba(0,0,0,0.75),0_0_40px_color-mix(in_srgb,var(--offpay-color-seasalt)_22%,transparent)]">
          Umbra vault
        </h1>
      </div>

      <UmbraVaultPanel />
    </div>
  );
}
