export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type KnownCard = {
  id: string;
  code: string;
  rank: Rank;
  suit: Suit;
  label?: string;
};

export type ComboKind =
  | "single"
  | "pair"
  | "triple"
  | "straight"
  | "flush"
  | "fullHouse"
  | "fourOfAKind"
  | "straightFlush";

export type Combo = {
  kind: ComboKind;
  cards: KnownCard[];
  size: number;
  strength: number[];
  label: string;
};

export type PlayContext = {
  activePlay: Combo | null;
  isFirstPlay: boolean;
  requiredOpeningCode?: string;
};

export type PlayValidation =
  | {
      ok: true;
      combo: Combo;
      message: string;
    }
  | {
      ok: false;
      combo: Combo | null;
      message: string;
    };

export type CandidatePlay = {
  cards: KnownCard[];
  combo: Combo;
};

const ranksByBig2Strength: Rank[] = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
const suitsByBig2Strength: Suit[] = ["diamonds", "clubs", "hearts", "spades"];

const rankValue = Object.fromEntries(ranksByBig2Strength.map((rank, index) => [rank, index])) as Record<Rank, number>;
const suitValue = Object.fromEntries(suitsByBig2Strength.map((suit, index) => [suit, index])) as Record<Suit, number>;

const fiveCardKindValue: Record<ComboKind, number> = {
  single: 0,
  pair: 0,
  triple: 0,
  straight: 1,
  flush: 2,
  fullHouse: 3,
  fourOfAKind: 4,
  straightFlush: 5,
};

const comboLabels: Record<ComboKind, string> = {
  single: "single",
  pair: "pair",
  triple: "triple",
  straight: "straight",
  flush: "flush",
  fullHouse: "full house",
  fourOfAKind: "four of a kind",
  straightFlush: "straight flush",
};

export function sortCards(cards: KnownCard[]): KnownCard[] {
  return [...cards].sort(compareCards);
}

export function compareCards(a: KnownCard, b: KnownCard): number {
  return cardPower(a) - cardPower(b);
}

export function cardPower(card: KnownCard): number {
  return rankValue[card.rank] * suitsByBig2Strength.length + suitValue[card.suit];
}

export function describeCombo(cards: KnownCard[]): Combo | null {
  const sortedCards = sortCards(cards);

  if (sortedCards.length === 1) {
    const card = sortedCards[0]!;
    return makeCombo("single", sortedCards, [cardPower(card)]);
  }

  if (sortedCards.length === 2 && allSameRank(sortedCards)) {
    return makeCombo("pair", sortedCards, [rankValue[sortedCards[0]!.rank], highestCardPower(sortedCards)]);
  }

  if (sortedCards.length === 3 && allSameRank(sortedCards)) {
    return makeCombo("triple", sortedCards, [rankValue[sortedCards[0]!.rank], highestCardPower(sortedCards)]);
  }

  if (sortedCards.length !== 5) {
    return null;
  }

  const straightHigh = straightHighValue(sortedCards);
  const flush = allSameSuit(sortedCards);
  const groups = rankGroups(sortedCards);
  const counts = [...groups.values()].map((group) => group.length).sort((a, b) => b - a);

  if (straightHigh !== null && flush) {
    return makeCombo("straightFlush", sortedCards, [straightHigh, highestCardPower(sortedCards)]);
  }

  if (counts[0] === 4) {
    const quad = [...groups.values()].find((group) => group.length === 4)!;
    return makeCombo("fourOfAKind", sortedCards, [rankValue[quad[0]!.rank], highestCardPower(quad)]);
  }

  if (counts[0] === 3 && counts[1] === 2) {
    const triple = [...groups.values()].find((group) => group.length === 3)!;
    const pair = [...groups.values()].find((group) => group.length === 2)!;
    return makeCombo("fullHouse", sortedCards, [rankValue[triple[0]!.rank], rankValue[pair[0]!.rank]]);
  }

  if (flush) {
    return makeCombo("flush", [...sortedCards], [...sortedCards].reverse().map(cardPower));
  }

  if (straightHigh !== null) {
    return makeCombo("straight", sortedCards, [straightHigh, highestCardPower(sortedCards)]);
  }

  return null;
}

export function validatePlay(cards: KnownCard[], context: PlayContext): PlayValidation {
  const combo = describeCombo(cards);

  if (combo === null) {
    return { ok: false, combo, message: "Select a single, pair, triple, or five-card hand." };
  }

  if (context.isFirstPlay && !containsCardCode(combo.cards, context.requiredOpeningCode ?? "3D")) {
    return { ok: false, combo, message: `Opening play must include ${context.requiredOpeningCode ?? "3D"}.` };
  }

  if (context.activePlay !== null && !canBeat(combo, context.activePlay)) {
    return { ok: false, combo, message: `Must beat ${context.activePlay.label}.` };
  }

  return { ok: true, combo, message: `Ready: ${combo.label}.` };
}

export function canBeat(candidate: Combo, activePlay: Combo): boolean {
  if (candidate.size !== activePlay.size) {
    return false;
  }

  if (candidate.size === 5) {
    const kindDifference = fiveCardKindValue[candidate.kind] - fiveCardKindValue[activePlay.kind];

    if (kindDifference !== 0) {
      return kindDifference > 0;
    }
  } else if (candidate.kind !== activePlay.kind) {
    return false;
  }

  return compareStrength(candidate.strength, activePlay.strength) > 0;
}

export function canPass(context: PlayContext): boolean {
  return context.activePlay !== null;
}

export function legalPlays(hand: KnownCard[], context: PlayContext): CandidatePlay[] {
  return candidatePlays(hand)
    .filter((candidate) => validatePlay(candidate.cards, context).ok)
    .sort((a, b) => compareCandidatePlays(a, b, context.activePlay));
}

export function chooseAutomatedPlay(hand: KnownCard[], context: PlayContext): CandidatePlay | null {
  return legalPlays(hand, context)[0] ?? null;
}

export function containsCardCode(cards: KnownCard[], code: string): boolean {
  return cards.some((card) => card.code === code);
}

function candidatePlays(hand: KnownCard[]): CandidatePlay[] {
  const sortedHand = sortCards(hand);
  const candidates: CandidatePlay[] = [];

  for (const card of sortedHand) {
    addCandidate(candidates, [card]);
  }

  for (const group of rankGroups(sortedHand).values()) {
    addCombinations(candidates, group, 2);
    addCombinations(candidates, group, 3);
  }

  addCombinations(candidates, sortedHand, 5);
  return candidates;
}

function addCombinations(candidates: CandidatePlay[], cards: KnownCard[], size: number): void {
  const selected: KnownCard[] = [];

  function visit(start: number): void {
    if (selected.length === size) {
      addCandidate(candidates, selected);
      return;
    }

    const remaining = size - selected.length;

    for (let index = start; index <= cards.length - remaining; index += 1) {
      selected.push(cards[index]!);
      visit(index + 1);
      selected.pop();
    }
  }

  if (cards.length >= size) {
    visit(0);
  }
}

function addCandidate(candidates: CandidatePlay[], cards: KnownCard[]): void {
  const combo = describeCombo(cards);

  if (combo !== null) {
    candidates.push({ cards: combo.cards, combo });
  }
}

function compareCandidatePlays(a: CandidatePlay, b: CandidatePlay, activePlay: Combo | null): number {
  if (activePlay === null && a.combo.size !== b.combo.size) {
    return a.combo.size - b.combo.size;
  }

  if (a.combo.size === 5 && b.combo.size === 5) {
    const kindDifference = fiveCardKindValue[a.combo.kind] - fiveCardKindValue[b.combo.kind];

    if (kindDifference !== 0) {
      return kindDifference;
    }
  }

  return compareStrength(a.combo.strength, b.combo.strength);
}

function makeCombo(kind: ComboKind, cards: KnownCard[], strength: number[]): Combo {
  return {
    kind,
    cards,
    size: cards.length,
    strength,
    label: comboLabels[kind],
  };
}

function compareStrength(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function highestCardPower(cards: KnownCard[]): number {
  return Math.max(...cards.map(cardPower));
}

function allSameRank(cards: KnownCard[]): boolean {
  return new Set(cards.map((card) => card.rank)).size === 1;
}

function allSameSuit(cards: KnownCard[]): boolean {
  return new Set(cards.map((card) => card.suit)).size === 1;
}

function straightHighValue(cards: KnownCard[]): number | null {
  const values = [...new Set(cards.map((card) => rankValue[card.rank]))].sort((a, b) => a - b);

  if (values.length !== 5) {
    return null;
  }

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] !== values[index - 1]! + 1) {
      return null;
    }
  }

  return values[values.length - 1]!;
}

function rankGroups(cards: KnownCard[]): Map<Rank, KnownCard[]> {
  const groups = new Map<Rank, KnownCard[]>();

  for (const card of cards) {
    groups.set(card.rank, [...(groups.get(card.rank) ?? []), card]);
  }

  return groups;
}
