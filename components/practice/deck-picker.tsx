"use client";
import { useState } from "react";
import { InteractiveDiagram } from "@/components/diagrams/interactive";
import { SegmentedControl } from "@/components/ui/segmented-control";

export interface DeckSummary {
  id: string;
  title: string;
  description: string;
  count: number;
}

/** One flashcard widget with a deck switcher, so every deck is one tap away without a very long page. */
export function DeckPicker({ decks }: { decks: DeckSummary[] }) {
  const [deck, setDeck] = useState(decks[0]?.id ?? "test");
  const current = decks.find((d) => d.id === deck) ?? decks[0];
  return (
    <div className="mt-3">
      <SegmentedControl<string> label="Flashcard deck" options={decks.map((d) => ({ value: d.id, label: d.title }))} value={deck} onChange={setDeck} size="sm" />
      {current ? (
        <p className="mt-3 text-ink-2" aria-live="polite">
          {current.description} <span className="font-mono text-sm text-ink-3">{current.count} cards</span>
        </p>
      ) : null}
      <InteractiveDiagram key={deck} name="recall-cards" variant={deck} />
    </div>
  );
}
