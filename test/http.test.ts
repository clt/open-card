import { afterEach, expect, test } from "bun:test";
import { memoryStore } from "../src/store/memoryStore";
import { addDeck, addPlayer, addZone, api, createTable, getTable, json, passDealer, setDealer, zoneByName } from "./helpers";

afterEach(() => {
  memoryStore.reset();
});

test("root page displays acceptance tests and results shell", async () => {
  const response = await api("GET", "/");
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(body).toContain("Acceptance Results");
  expect(body).toContain("Dealer");
  expect(body).toContain("Texas hold'em");
  expect(body).toContain("鋤大弟");
  expect(body).toContain("0/3");
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
    selection: { type: "zoneCount", zoneId: draw.zone.id, count: 1, from: "top" },
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

test("HTTP sets and passes dealer state", async () => {
  const table = await createTable("Dealer API table");
  const alice = (await addPlayer(table.id, "Alice")).player;
  const bob = (await addPlayer(table.id, "Bob")).player;

  const setResponse = await setDealer(table.id, {
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: alice.id,
    actorPlayerId: bob.id,
  });

  expect(setResponse.dealer).toEqual({
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: alice.id,
  });
  expect(setResponse.table.dealer).toEqual(setResponse.dealer);

  const passResponse = await passDealer(table.id, { actorPlayerId: alice.id });

  expect(passResponse.dealer).toEqual({
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: bob.id,
  });
  expect((await getTable(table.id)).dealer).toEqual(passResponse.dealer);
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
    selection: { type: "zoneCount", zoneId: zone.id, count: 53, from: "top" },
    to: "bottom",
  });

  expect(conflict.status).toBe(409);
});

test("HTTP returns dealer validation errors without mutating table state", async () => {
  const table = await createTable("Dealer errors");
  const alice = (await addPlayer(table.id, "Alice")).player;

  const missingActor = await api("POST", `/tables/${table.id}/dealer`, {
    actor: { type: "player", playerId: "missing_player" },
  });
  expect(missingActor.status).toBe(404);
  expect((await getTable(table.id)).dealer).toEqual({ actor: null, positionPlayerId: null });

  const missingPosition = await api("POST", `/tables/${table.id}/dealer`, {
    positionPlayerId: "missing_player",
  });
  expect(missingPosition.status).toBe(404);
  expect((await getTable(table.id)).dealer).toEqual({ actor: null, positionPlayerId: null });

  await setDealer(table.id, { actor: { type: "player", playerId: alice.id } });

  const passWithoutPosition = await api("POST", `/tables/${table.id}/dealer/pass`, {});
  expect(passWithoutPosition.status).toBe(409);
  expect((await getTable(table.id)).dealer).toEqual({
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: null,
  });
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
    selection: { type: "zoneCount", zoneId: draw.zone.id, count: 1, from: "top" },
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

test("dealer events are public summaries without metadata", async () => {
  const table = await createTable("Dealer events");
  const alice = (await addPlayer(table.id, "Alice")).player;
  const bob = (await addPlayer(table.id, "Bob")).player;

  await setDealer(table.id, {
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: alice.id,
  });
  await passDealer(table.id, { actorPlayerId: bob.id });

  const response = await api("GET", `/tables/${table.id}/events`);
  const body = await json<{ events: Array<Record<string, unknown>> }>(response);

  expect(response.status).toBe(200);
  expect(body.events).toContainEqual(
    expect.objectContaining({
      type: "dealer.updated",
      summary: "Dealer updated.",
    }),
  );
  expect(body.events).toContainEqual(
    expect.objectContaining({
      type: "dealer.passed",
      summary: "Dealer position passed from Alice to Bob.",
    }),
  );
  expect(body.events.every((event) => !("metadata" in event))).toBe(true);
});
