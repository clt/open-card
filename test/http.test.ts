import { afterEach, expect, test } from "bun:test";
import { memoryStore } from "../src/store/memoryStore";
import { addDeck, addPlayer, addZone, api, createTable, getTable, json, zoneByName } from "./helpers";

afterEach(() => {
  memoryStore.reset();
});

test("root page displays acceptance tests and results shell", async () => {
  const response = await api("GET", "/");
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(body).toContain("Acceptance Results");
  expect(body).toContain("Texas hold'em");
  expect(body).toContain("鋤大弟");
  expect(body).toContain("data-testid=\"acceptance-results\"");
});

test("HTTP creates table, player, zone, deck, and projected table state", async () => {
  const table = await createTable("API table");
  const { player } = await addPlayer(table.id, "Ada");
  const draw = await addZone(table.id, { name: "Draw" });
  const handZone = await addZone(table.id, { name: "Ada Hand", ownerPlayerId: player.id });
  const deck = await addDeck(table.id, draw.zone.id);
  const move = await api("POST", `/tables/${table.id}/move`, {
    fromZoneId: draw.zone.id,
    toZoneId: handZone.zone.id,
    selection: { type: "count", count: 1, from: "top" },
    to: "bottom",
    actorPlayerId: player.id,
  });
  const projected = await getTable(table.id, player.id);
  const hand = zoneByName(projected, "Ada Hand");

  expect(deck.cardsAdded).toBe(52);
  expect(move.status).toBe(200);
  expect(projected.players).toContainEqual(player);
  expect(hand.count).toBe(1);
  expect(hand.cards[0]).toMatchObject({ code: "AC", unknown: false });
});

test("HTTP returns validation, not found, and conflict errors", async () => {
  const invalid = await api("POST", "/tables", "{");
  expect(invalid.status).toBe(400);

  const missing = await api("GET", "/tables/missing");
  expect(missing.status).toBe(404);

  const table = await createTable();
  const { zone } = await addZone(table.id, { name: "Draw" });
  await addDeck(table.id, zone.id);

  const conflict = await api("POST", `/tables/${table.id}/move`, {
    fromZoneId: zone.id,
    toZoneId: zone.id,
    selection: { type: "count", count: 53, from: "top" },
    to: "bottom",
  });

  expect(conflict.status).toBe(409);
});

test("event endpoint exposes safe summaries without card identity metadata", async () => {
  const table = await createTable();
  const { player } = await addPlayer(table.id, "Ada");
  const draw = await addZone(table.id, { name: "Draw" });
  const hand = await addZone(table.id, { name: "Ada Hand", ownerPlayerId: player.id });
  await addDeck(table.id, draw.zone.id);
  await api("POST", `/tables/${table.id}/move`, {
    fromZoneId: draw.zone.id,
    toZoneId: hand.zone.id,
    selection: { type: "count", count: 1, from: "top" },
    to: "bottom",
    actorPlayerId: player.id,
  });

  const response = await api("GET", `/tables/${table.id}/events`);
  const body = await json<{ events: Array<Record<string, unknown>> }>(response);
  const serialized = JSON.stringify(body);

  expect(response.status).toBe(200);
  expect(serialized).toContain("Moved 1 card from Draw to Ada Hand.");
  expect(serialized).not.toContain("Ace of Clubs");
  expect(serialized).not.toContain("AC");
  expect(serialized).not.toContain("card_1");
  expect(body.events.every((event) => !("metadata" in event))).toBe(true);
});
