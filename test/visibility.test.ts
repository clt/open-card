import { expect, test } from "bun:test";
import { addPlayer, addStandardDeck, createZone, flipCards, hideCards, moveCards, revealCards } from "../src/domain/operations";
import { createTable } from "../src/domain/table";
import { projectTable } from "../src/domain/visibility";

test("owner sees private hand card identity while other viewers see placeholders", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const bob = addPlayer(table, { name: "Bob" });
  const draw = createZone(table, { name: "Draw" });
  const aliceHand = createZone(table, { name: "Alice Hand", ownerPlayerId: alice.id });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  moveCards(table, {
    fromZoneId: draw.id,
    toZoneId: aliceHand.id,
    selection: { type: "zoneCount", zoneId: draw.id, count: 1, from: "top" },
    to: "bottom",
  });

  const aliceView = projectTable(table, alice.id);
  const bobView = projectTable(table, bob.id);
  const publicView = projectTable(table);
  const aliceCard = aliceView.zones.find((zone) => zone.id === aliceHand.id)!.cards[0]!;
  const bobCard = bobView.zones.find((zone) => zone.id === aliceHand.id)!.cards[0]!;
  const publicCard = publicView.zones.find((zone) => zone.id === aliceHand.id)!.cards[0]!;

  expect(aliceCard).toMatchObject({ id: cardId, code: "AC", unknown: false });
  expect(bobCard).toEqual({ id: cardId, face: "down", unknown: true });
  expect(publicCard).toEqual({ id: cardId, face: "down", unknown: true });
});

test("flip up reveals to everyone, reveal/hide controls face-down visibility", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const bob = addPlayer(table, { name: "Bob" });
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  revealCards(table, {
    selection: { type: "cardIds", cardIds: [cardId] },
    to: { playerIds: [alice.id] },
  });
  expect(projectTable(table, alice.id).zones[0]!.cards[0]!.unknown).toBe(false);
  expect(projectTable(table, bob.id).zones[0]!.cards[0]!.unknown).toBe(true);

  hideCards(table, {
    selection: { type: "cardIds", cardIds: [cardId] },
    from: { playerIds: [alice.id] },
  });
  expect(projectTable(table, alice.id).zones[0]!.cards[0]!.unknown).toBe(true);

  flipCards(table, {
    selection: { type: "cardIds", cardIds: [cardId] },
    face: "up",
  });
  expect(projectTable(table).zones[0]!.cards[0]).toMatchObject({ id: cardId, code: "AC", unknown: false });
});

test("revealCards to everyone makes card visible to all viewers", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const bob = addPlayer(table, { name: "Bob" });
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  revealCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, to: "everyone" });

  expect(table.cards[cardId]!.visibility.everyone).toBe(true);
  expect(projectTable(table, alice.id).zones[0]!.cards[0]!.unknown).toBe(false);
  expect(projectTable(table, bob.id).zones[0]!.cards[0]!.unknown).toBe(false);
  expect(projectTable(table).zones[0]!.cards[0]!.unknown).toBe(false);
});

test("hideCards from everyone clears the everyone flag while preserving player grants", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  revealCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, to: "everyone" });
  revealCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, to: { playerIds: [alice.id] } });
  hideCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, from: "everyone" });

  expect(table.cards[cardId]!.visibility.everyone).toBe(false);
  expect(table.cards[cardId]!.visibility.playerIds).toContain(alice.id);
});

test("hideCards from all clears both everyone flag and all player grants", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const draw = createZone(table, { name: "Draw" });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  revealCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, to: "everyone" });
  revealCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, to: { playerIds: [alice.id] } });
  hideCards(table, { selection: { type: "cardIds", cardIds: [cardId] }, from: "all" });

  expect(table.cards[cardId]!.visibility).toEqual({ everyone: false, playerIds: [] });
  expect(projectTable(table, alice.id).zones[0]!.cards[0]!.unknown).toBe(true);
});

test("cards moved into an everyone zone become visible to all", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const draw = createZone(table, { name: "Draw" });
  const board = createZone(table, { name: "Board", defaultVisibility: { type: "everyone" } });
  addStandardDeck(table, { zoneId: draw.id });

  moveCards(table, {
    fromZoneId: draw.id,
    toZoneId: board.id,
    selection: { type: "zoneCount", zoneId: draw.id, count: 3, from: "top" },
    to: "bottom",
  });

  const boardView = projectTable(table, alice.id).zones.find((z) => z.id === board.id)!;
  expect(boardView.cards.every((c) => c.unknown === false)).toBe(true);
  expect(projectTable(table).zones.find((z) => z.id === board.id)!.cards.every((c) => c.unknown === false)).toBe(true);
});

test("cards moved into a players zone become visible to exactly those players", () => {
  const table = createTable();
  const alice = addPlayer(table, { name: "Alice" });
  const bob = addPlayer(table, { name: "Bob" });
  const draw = createZone(table, { name: "Draw" });
  const shared = createZone(table, {
    name: "Shared",
    defaultVisibility: { type: "players", playerIds: [alice.id] },
  });
  addStandardDeck(table, { zoneId: draw.id });
  const cardId = draw.cardIds[0]!;

  moveCards(table, {
    fromZoneId: draw.id,
    toZoneId: shared.id,
    selection: { type: "zoneCount", zoneId: draw.id, count: 1, from: "top" },
    to: "bottom",
  });

  expect(table.cards[cardId]!.visibility.playerIds).toEqual([alice.id]);
  expect(projectTable(table, alice.id).zones.find((z) => z.id === shared.id)!.cards[0]!.unknown).toBe(false);
  expect(projectTable(table, bob.id).zones.find((z) => z.id === shared.id)!.cards[0]!.unknown).toBe(true);
});
