import { DiagramFrame } from "./diagram-frame";
import { staticDiagrams } from "./static";

/**
 * A hand-drawn static SVG diagram (components/diagrams/static) in a scrollable, captioned figure. When it
 * is too cramped to read inline, DiagramFrame offers the same component again in a zoomable lightbox.
 */
export function Diagram({ name, caption }: { name: string; caption?: string }) {
  const Svg = staticDiagrams[name];
  return (
    <DiagramFrame caption={caption} expandedNode={Svg ? <Svg /> : undefined}>
      {Svg ? <Svg /> : <p className="text-sm text-bad">Missing diagram “{name}”.</p>}
    </DiagramFrame>
  );
}
