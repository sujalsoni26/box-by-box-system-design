import type { CaseStudy } from "@/types/case-study";

export const study: CaseStudy = {
  slug: "lld-chess",
  title: "Design a chess game",
  track: "lld",
  level: "advanced",
  minutes: 50,
  scenario: "Two players alternate moves on a standard board with the full rules for all six pieces, including castling, en passant and promotion. After every move the game reports check, checkmate or stalemate; it supports draw claims and resignation, lets a casual player undo the last move, and can replay a finished game. It must also expose the legal moves for the side to move, so a user interface can highlight them and an engine could search them.",
  focus: "Splitting where a piece could go (geometry, polymorphic per piece) from whether a move is legal (decided once by the board for every piece), and making every move reversible so legality, undo and replay share one mechanism.",
  concepts: ["oop-pillars", "composition-over-inheritance", "design-patterns-behavioural", "concurrency-basics", "lld-snake-and-ladder"],
  steps: [
    {
      prompt: "What is in scope for a first version, and what performance budget do you assume for checking whether a move is legal?",
      hint: "Separate the laws of the game from everything around it: clocks, ratings, networking, an engine. For the budget, ask who is making the moves and how often.",
      insight: "Full movement rules including the three special moves, check, checkmate and stalemate, draw claims, resignation, undo, replay and a legal-move list; networking, clocks, ratings, notation and an engine are out. Humans move every few seconds, so generating and simulating every candidate move is affordable; an engine would need far more.",
    },
    {
      prompt: "What should a Piece object know? And where do facts such as 'has this king moved' or 'where may an en passant capture land' belong?",
      hint: "If a piece knew its own square, could one white knight object stand on both knight squares? Which facts depend on the history of the game rather than on any one piece?",
      insight: "A piece holds only its colour and its movement geometry, so the six subclasses are immutable and shareable, and the board knows which piece stands where. Castling rights, the en passant target and the half-move clock are facts about the position, its irreversible aspects, so they live on the Board, which is what makes undo tractable.",
    },
    {
      prompt: "A pinned bishop, a king stepping into check, castling through an attacked square: how do you decide legality without writing special cases into each piece?",
      hint: "Separate 'every square this piece's movement rule reaches' from the single rule about your own king. Is there a way to test that rule identically for every move?",
      insight: "Pieces generate pseudo-legal candidateMoves polymorphically; the board decides legality once by applying the move, testing whether the mover's king is attacked, and reverting. Checkmate and stalemate are both 'no legal moves', split by whether the side to move is in check.",
    },
    {
      prompt: "How do you implement undo and replay so that captures, castling rights, en passant and promotion all come back correctly? Name the patterns you use.",
      hint: "Written notation records a move but not everything the move destroyed. What must be captured at the moment a move is applied, and what object could carry both the move and that record?",
      insight: "Board.apply returns an Undo record (the moved piece, the captured piece, castling rights, en passant target, half-move clock) that revert consumes, which is a Memento. Each executed move is a MoveCommand holding its Undo on a MoveHistory stack, so undo pops and reverts and replay runs play in a loop from a fresh board: the same make-and-unmake that the legality test uses.",
    },
    {
      prompt: "Composition is usually the safer default. Why is a Piece class hierarchy acceptable here, and when would you replace it?",
      hint: "Recall when inheritance earns its place: a true subtype, a parent designed for it, rules that do not change. Then imagine fairy pieces loaded from configuration, or an engine that needs bitboards.",
      insight: "There are six types, each rule is a dozen lines fixed by the laws of the game, and Queen, Rook and Bishop share a sliding generator, so the hierarchy is readable and a new piece is one subclass. When rules come from configuration or a search needs bitboards, the piece becomes plain data and the geometry moves into a MoveGenerator Strategy per piece type.",
    },
    {
      prompt: "Generating castling asks whether squares are attacked, and the default attack test reuses candidate moves. What goes wrong? And which Move object should play() actually execute when a client sends one?",
      hint: "Follow the call chain when the enemy king is asked whether it attacks a square. For play(), compare trusting the client's Move with finding one you generated yourself.",
      insight: "The enemy king's default attacks would generate its own castling, which calls isAttacked again, so the king overrides attacks with its eight adjacent squares and the recursion never starts. The play method matches the request against the generated legal list and executes that Move, never the client's, so the captured piece and move type are always right and an illegal request leaves the board untouched.",
    },
    {
      prompt: "Chess is turn-based. Is there any shared mutable state worth protecting, and how would a server host thousands of games?",
      hint: "Look at what legalMoves does to the live board while it simulates, and at who else might be reading that board at the time.",
      insight: "Generating legal moves mutates the live board while simulating, so a user-interface thread reading at that moment could see a move that was never played; publish an immutable snapshot after each accepted move and let readers use that. A server keeps one Game per table and serialises calls on it with a lock or a single-threaded executor; games share nothing, so there is no lock order to design.",
    },
  ],
  tradeoffs: [
    "Simulate-and-test legality vs generating only legal moves: choose simulate-and-test because one rule covers every piece, pin and special move; it costs two board edits per candidate, nothing for humans but a problem for engines.",
    "A piece class hierarchy vs a MoveGenerator per piece type: choose the hierarchy when the rules are fixed and the caller is a human; choose generators when the rules come from configuration or the caller is a search.",
    "An Undo record per move vs copying the whole board: choose the record for a small, exact snapshot of what a move destroys, accepting that every apply saves and every revert restores three extra fields.",
  ],
  followUps: [
    "Add a chancellor, which moves as a rook or a knight. Which classes change?",
    "How would you detect threefold repetition?",
    "Turn this into an engine's inner loop. What becomes the bottleneck, and how do engines avoid it?",
    "Chess960 shuffles the back rank. Which part of the castling logic must change?",
  ],
};
