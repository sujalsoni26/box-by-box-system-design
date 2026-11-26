"use client";
import { useEffect, useRef, useState } from "react";
import { ANIMATED_INTERACTIVES, interactiveRegistry, type InteractiveName } from "./interactive-registry";
import { INTERACTIVE_TITLES } from "./interactive-titles";
import { SimSpeedProvider } from "./sim-speed";
import { useInView } from "@/lib/hooks/use-in-view";

interface InteractiveDiagramProps {
  name: string;
  variant?: string;
}

function isInteractiveName(name: string): name is InteractiveName {
  return name in interactiveRegistry;
}

/**
 * Embeds an interactive diagram. It is downloaded and mounted only when it nears the viewport,
 * then stays mounted so its state survives scrolling.
 */
export function InteractiveDiagram({ name, variant }: InteractiveDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, "600px");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (near && !mounted) {
      const id = window.setTimeout(() => setMounted(true), 0);
      return () => window.clearTimeout(id);
    }
  }, [near, mounted]);

  if (!isInteractiveName(name)) {
    return <p className="my-6 rounded-lg bg-bad-soft p-3 text-sm text-bad">Unknown interactive diagram “{name}”.</p>;
  }
  const Component = interactiveRegistry[name];
  return (
    <div
      ref={ref}
      id={`try-${name}${variant ? `-${variant}` : ""}`}
      data-toc={`Try it: ${INTERACTIVE_TITLES[name] ?? name}`}
      data-toc-level="2"
      data-companion-avoid=""
      data-interactive={name}
      className="min-h-[14rem] scroll-mt-24"
    >
      {mounted ? (
        // Each block owns its playback speed; the provider scopes it to this block only.
        <SimSpeedProvider animated={ANIMATED_INTERACTIVES.has(name)}>
          <Component variant={variant} />
        </SimSpeedProvider>
      ) : (
        <div className="my-8 grid h-56 place-items-center rounded-2xl border border-dashed border-line-strong bg-surface-2 text-sm text-ink-3">
          Simulation loads as you scroll here.
        </div>
      )}
    </div>
  );
}
