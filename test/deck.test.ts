import { expect, test } from "bun:test";
import { createStandardDeck } from "../src/domain/card";

test("standard deck has 52 unique physical cards with expected faces", () => {
  let sequence = 0;
  const deck = createStandardDeck(() => {
    sequence += 1;
    return `card_${sequence}`;
  });

  expect(deck).toHaveLength(52);
  expect(new Set(deck.map((card) => card.id)).size).toBe(52);
  expect(deck[0]).toMatchObject({
    id: "card_1",
    code: "AC",
    rank: "A",
    suit: "clubs",
    label: "Ace of Clubs",
    face: "down",
    visibility: { everyone: false, playerIds: [] },
  });
  expect(deck.at(-1)).toMatchObject({
    id: "card_52",
    code: "KS",
    rank: "K",
    suit: "spades",
    label: "King of Spades",
  });
  expect(new Set(deck.map((card) => card.code)).size).toBe(52);
});
