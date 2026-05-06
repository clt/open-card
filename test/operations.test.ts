import { expect, test } from "bun:test";
import {
  addPlayer,
  addStandardDeck,
  createZone,
  cutZone,
  dealCards,
  flipCards,
  hideCards,
  moveCards,
  passDealerPosition,
  revealCards,
  setDealer,
  shuffleZone,
} from "../src/domain/operations";
import { createTable } from "../src/domain/table";

test("cut preserves card set and moves the top segment to the bottom", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const original = [...draw.cardIds];

  cutZone(table, { zoneId: draw.id, at: 13 });

  expect(draw.cardIds).toHaveLength(52);
  expect([...draw.cardIds].sort()).toEqual([...original].sort());
  expect(draw.cardIds[0]).toBe(original[13]);
  expect(draw.cardIds.at(-1)).toBe(original[12]);
});

test("shuffle preserves the exact card set", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const original = [...draw.cardIds];

  shuffleZone(table, { zoneId: draw.id });

  expect(draw.cardIds).toHaveLength(52);
  expect([...draw.cardIds].sort()).toEqual([...original].sort());
});

test("move supports count from top and bottom while preserving order", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  const discard = createZone(table, { name: "Discard" });
  addStandardDeck(table, { zoneId: draw.id });
  const original = [...draw.cardIds];

  const topMoved = moveCards(table, {
    fromZoneId: draw.id,
    toZoneId: discard.id,
    selection: { type: "zoneCount", zoneId: draw.id, count: 2, from: "top" },
    to: "bottom",
  });
  const bottomMoved = moveCards(table, {
    fromZoneId: draw.id,
    toZoneId: discard.id,
    selection: { type: "zoneCount", zoneId: draw.id, count: 2, from: "bottom" },
    to: "bottom",
  });

  expect(topMoved).toEqual([original[0]!, original[1]!]);
  expect(bottomMoved).toEqual([original[50]!, original[51]!]);
  expect(discard.cardIds).toEqual([original[0]!, original[1]!, original[50]!, original[51]!]);
  expect(draw.cardIds).toHaveLength(48);
});

test("move by explicit card IDs preserves requested order and can insert on top", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  const hand = createZone(table, { name: "Hand" });
  addStandardDeck(table, { zoneId: draw.id });
  const original = [...draw.cardIds];

  const moved = moveCards(table, {
    fromZoneId: draw.id,
    toZoneId: hand.id,
    selection: { type: "cardIds", cardIds: [original[4]!, original[1]!, original[3]!] },
    to: "top",
  });

  expect(moved).toEqual([original[4]!, original[1]!, original[3]!]);
  expect(hand.cardIds).toEqual([original[4]!, original[1]!, original[3]!]);
  expect(draw.cardIds).not.toContain(original[4]!);
  expect(new Set([...draw.cardIds, ...hand.cardIds]).size).toBe(52);
});

test("failed explicit move does not mutate either zone", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  const hand = createZone(table, { name: "Hand" });
  addStandardDeck(table, { zoneId: draw.id });
  const originalDraw = [...draw.cardIds];

  expect(() =>
    moveCards(table, {
      fromZoneId: draw.id,
      toZoneId: hand.id,
      selection: { type: "cardIds", cardIds: [originalDraw[0]!, "missing_card"] },
      to: "bottom",
    }),
  ).toThrow("missing_card");

  expect(draw.cardIds).toEqual(originalDraw);
  expect(hand.cardIds).toEqual([]);
});

test("deal distributes cards round-robin", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  const players = ["North", "East", "South", "West"].map((name) => addPlayer(table, { name }));
  const hands = players.map((player) => createZone(table, { name: `${player.name} Hand`, ownerPlayerId: player.id }));
  addStandardDeck(table, { zoneId: draw.id });
  const original = [...draw.cardIds];

  dealCards(table, {
    fromZoneId: draw.id,
    toZoneIds: hands.map((hand) => hand.id),
    cardsPerTarget: 2,
    from: "top",
    to: "bottom",
  });

  expect(hands[0]!.cardIds).toEqual([original[0]!, original[4]!]);
  expect(hands[1]!.cardIds).toEqual([original[1]!, original[5]!]);
  expect(hands[2]!.cardIds).toEqual([original[2]!, original[6]!]);
  expect(hands[3]!.cardIds).toEqual([original[3]!, original[7]!]);
  expect(draw.cardIds).toHaveLength(44);
});

test("dealer actor and position can be set and cleared independently", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const bob = addPlayer(table, { name: "Bob" });

  setDealer(table, {
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: bob.id,
  });

  expect(table.dealer).toEqual({
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: bob.id,
  });

  setDealer(table, { actor: { type: "nonPlayer", name: "House" } });

  expect(table.dealer).toEqual({
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: bob.id,
  });

  setDealer(table, { actor: null, positionPlayerId: null });

  expect(table.dealer).toEqual({ actor: null, positionPlayerId: null });
});

test("dealer player references must exist", () => {
  const table = createTable();

  expect(() => setDealer(table, { actor: { type: "player", playerId: "missing_player" } })).toThrow("missing_player");
  expect(() => setDealer(table, { positionPlayerId: "missing_player" })).toThrow("missing_player");
});

test("passing dealer position follows player join order and preserves actor", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const bob = addPlayer(table, { name: "Bob" });
  const carol = addPlayer(table, { name: "Carol" });

  setDealer(table, {
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: alice.id,
  });

  passDealerPosition(table);
  expect(table.dealer).toEqual({
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: bob.id,
  });

  passDealerPosition(table);
  expect(table.dealer.positionPlayerId).toBe(carol.id);

  passDealerPosition(table);
  expect(table.dealer.positionPlayerId).toBe(alice.id);

  passDealerPosition(table, { direction: "previous" });
  expect(table.dealer.positionPlayerId).toBe(carol.id);
});

test("passing dealer position requires an existing position and does not mutate actor", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });

  setDealer(table, { actor: { type: "player", playerId: alice.id } });

  expect(() => passDealerPosition(table)).toThrow("Dealer position is not set.");
  expect(table.dealer).toEqual({
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: null,
  });
});

test("flip with zoneCount selects cards from the named zone", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const original = [...draw.cardIds];

  const flipped = flipCards(table, {
    selection: { type: "zoneCount", zoneId: draw.id, count: 3, from: "top" },
    face: "up",
  });

  expect(flipped).toEqual([original[0]!, original[1]!, original[2]!]);
  expect(flipped.every((id) => table.cards[id]!.face === "up")).toBe(true);
  expect(table.cards[original[3]!]!.face).toBe("down");
});

test("flip with zoneCount from bottom selects the tail of the zone", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const original = [...draw.cardIds];

  const flipped = flipCards(table, {
    selection: { type: "zoneCount", zoneId: draw.id, count: 2, from: "bottom" },
    face: "up",
  });

  expect(flipped).toEqual([original[50]!, original[51]!]);
});

test("reveal with zoneCount grants visibility to specified players", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const bob = addPlayer(table, { name: "Bob" });
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const [first, second] = draw.cardIds;

  revealCards(table, {
    selection: { type: "zoneCount", zoneId: draw.id, count: 2, from: "top" },
    to: { playerIds: [alice.id] },
  });

  expect(table.cards[first!]!.visibility.playerIds).toContain(alice.id);
  expect(table.cards[first!]!.visibility.playerIds).not.toContain(bob.id);
  expect(table.cards[second!]!.visibility.playerIds).toContain(alice.id);
});

test("hide with zoneCount removes visibility from specified players", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  revealCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, to: { playerIds: [alice.id] } });
  expect(table.cards[cardId]!.visibility.playerIds).toContain(alice.id);

  hideCards(table, {
    selection: { type: "zoneCount", zoneId: draw.id, count: 1, from: "top" },
    from: { playerIds: [alice.id] },
  });

  expect(table.cards[cardId]!.visibility.playerIds).not.toContain(alice.id);
});

test("zoneCount selection rejects a non-existent zone", () => {
  const table = createTable();

  expect(() =>
    flipCards(table, {
      selection: { type: "zoneCount", zoneId: "missing_zone", count: 1, from: "top" },
      face: "up",
    }),
  ).toThrow("missing_zone");
});

test("zoneCount selection rejects a count that exceeds the zone size", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });

  expect(() =>
    flipCards(table, {
      selection: { type: "zoneCount", zoneId: draw.id, count: 53, from: "top" },
      face: "up",
    }),
  ).toThrow();
});

test("cardIds selection rejects duplicate IDs", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  expect(() =>
    flipCards(table, {
      selection: { type: "cardIds", cardIds: [cardId, cardId] },
      face: "up",
    }),
  ).toThrow("cardIds must be unique");
});

test("cardIds selection rejects a non-existent card", () => {
  const table = createTable();

  expect(() =>
    flipCards(table, {
      selection: { type: "cardIds", cardIds: ["missing_card"] },
      face: "up",
    }),
  ).toThrow("missing_card");
});

test("move rejects zoneCount selection whose zoneId does not match fromZoneId", () => {
  const table = createTable();
  const draw = createZone(table, { name: "Draw" });
  const hand = createZone(table, { name: "Hand" });
  addStandardDeck(table, { zoneId: draw.id });

  expect(() =>
    moveCards(table, {
      fromZoneId: draw.id,
      toZoneId: hand.id,
      selection: { type: "zoneCount", zoneId: hand.id, count: 1, from: "top" },
      to: "bottom",
    }),
  ).toThrow("fromZoneId");
});
