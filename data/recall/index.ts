// Flashcard decks for active recall (Practice page and the "Test yourself" / "Revision" lessons).
// One file per deck (data/recall/<deck>.ts).
import type { RecallDeck, RecallDeckId } from "./types";
import { deck as test } from "./test";
import { deck as revision } from "./revision";
import { deck as advanced } from "./advanced";
import { deck as hld } from "./hld";
import { deck as lld } from "./lld";

export type { RecallDeck, RecallDeckId } from "./types";

export const recallDecks: Record<RecallDeckId, RecallDeck> = { test, revision, advanced, hld, lld };
