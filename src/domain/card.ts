export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Face = "up" | "down";

export type CardVisibility = {
  everyone: boolean;
  playerIds: string[];
};

export type Card = {
  id: string;
  code: string;
  rank: Rank;
  suit: Suit;
  label: string;
  face: Face;
  visibility: CardVisibility;
};

const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const suitCodes: Record<Suit, string> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
};

const rankLabels: Partial<Record<Rank, string>> = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

const suitLabels: Record<Suit, string> = {
  clubs: "Clubs",
  diamonds: "Diamonds",
  hearts: "Hearts",
  spades: "Spades",
};

export function createStandardDeck(nextCardId: () => string): Card[] {
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: nextCardId(),
      code: `${rank}${suitCodes[suit]}`,
      rank,
      suit,
      label: `${rankLabels[rank] ?? rank} of ${suitLabels[suit]}`,
      face: "down" as const,
      visibility: hiddenVisibility(),
    })),
  );
}

export function hiddenVisibility(): CardVisibility {
  return { everyone: false, playerIds: [] };
}

export function cloneVisibility(visibility: CardVisibility): CardVisibility {
  return {
    everyone: visibility.everyone,
    playerIds: [...visibility.playerIds],
  };
}
