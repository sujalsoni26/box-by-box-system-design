import type { RecallCard } from "@/types/quiz";

export type RecallDeckId = "test" | "revision" | "advanced" | "hld" | "lld";

export interface RecallDeck { id: RecallDeckId; title: string; description: string; cards: RecallCard[] }
