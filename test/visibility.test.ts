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
