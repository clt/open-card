import { afterEach, expect, test } from "bun:test";
import { memoryStore } from "../src/store/memoryStore";
import {
  addDeck,
  addPlayer,
  addZone,
  allCardIds,
  api,
  createTable,
  getTable,
  json,
  passDealer,
  setDealer,
  zoneByName,
} from "./helpers";

afterEach(() => {
  memoryStore.reset();
});

test("acceptance: non-player dealer actor can pass player position and wrap", async () => {
  const table = await createTable("Dealer rotation table");
  const alice = (await addPlayer(table.id, "Alice")).player;
  const bob = (await addPlayer(table.id, "Bob")).player;
  const carol = (await addPlayer(table.id, "Carol")).player;

  await setDealer(table.id, {
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: alice.id,
  });

  expect((await getTable(table.id)).dealer).toEqual({
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: alice.id,
  });

  expect((await passDealer(table.id)).dealer).toEqual({
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: bob.id,
  });
  expect((await passDealer(table.id)).dealer.positionPlayerId).toBe(carol.id);
  expect((await passDealer(table.id)).dealer.positionPlayerId).toBe(alice.id);
});

test("acceptance: player dealer actor is independent from dealer position", async () => {
  const table = await createTable("Dealer actor independence table");
  const alice = (await addPlayer(table.id, "Alice")).player;
  const bob = (await addPlayer(table.id, "Bob")).player;

  await setDealer(table.id, {
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: alice.id,
  });

  expect((await passDealer(table.id, { actorPlayerId: bob.id })).dealer).toEqual({
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: bob.id,
  });

  expect((await getTable(table.id)).dealer).toEqual({
    actor: { type: "player", playerId: alice.id },
    positionPlayerId: bob.id,
  });
});

test("acceptance: existing deal operation remains generic with dealer metadata", async () => {
  const table = await createTable("Dealer generic deal table");
  const alice = (await addPlayer(table.id, "Alice")).player;
  const bob = (await addPlayer(table.id, "Bob")).player;
  const draw = (await addZone(table.id, { name: "Draw" })).zone;
  const aliceHand = (await addZone(table.id, { name: "Alice Hand", ownerPlayerId: alice.id })).zone;
  const bobHand = (await addZone(table.id, { name: "Bob Hand", ownerPlayerId: bob.id })).zone;

  await setDealer(table.id, {
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: alice.id,
  });

  const deckResponse = await addDeck(table.id, draw.id);
  const originalDeckIds = zoneByName(deckResponse.table, "Draw").cards.map((card) => card.id);
  const dealResponse = await api("POST", `/tables/${table.id}/deal`, {
    fromZoneId: draw.id,
    toZoneIds: [aliceHand.id, bobHand.id],
    cardsPerTarget: 2,
    from: "top",
    to: "bottom",
    actorPlayerId: bob.id,
  });

  expect(dealResponse.status).toBe(200);

  const projected = await getTable(table.id);

  expect(projected.dealer).toEqual({
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: alice.id,
  });
  expect(zoneByName(projected, "Alice Hand").count).toBe(2);
  expect(zoneByName(projected, "Bob Hand").count).toBe(2);
  expect(zoneByName(projected, "Alice Hand").cards.map((card) => card.id)).toEqual([
    originalDeckIds[0]!,
    originalDeckIds[2]!,
  ]);
  expect(zoneByName(projected, "Bob Hand").cards.map((card) => card.id)).toEqual([
    originalDeckIds[1]!,
    originalDeckIds[3]!,
  ]);
  expect([...allCardIds(projected)].sort()).toEqual([...originalDeckIds].sort());
  expect(new Set(allCardIds(projected)).size).toBe(52);
});

test("acceptance: dealer public events are safe and useful", async () => {
  const table = await createTable("Dealer event table");
  const alice = (await addPlayer(table.id, "Alice")).player;
  const bob = (await addPlayer(table.id, "Bob")).player;

  await setDealer(table.id, {
    actor: { type: "nonPlayer", name: "House" },
    positionPlayerId: alice.id,
  });
  await passDealer(table.id, { actorPlayerId: bob.id });

  const response = await api("GET", `/tables/${table.id}/events`);
  const body = await json<{ events: Array<Record<string, unknown>> }>(response);
  const serialized = JSON.stringify(body);

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
  expect(serialized).not.toContain("cardIds");
  expect(serialized).not.toContain("code");
});

test("acceptance: 5 players can physically deal Texas hold'em through the generic API", async () => {
  const table = await createTable("Texas hold'em table");
  const players = [];

  for (const name of ["Alice", "Ben", "Carl", "Dana", "Eli"]) {
    players.push((await addPlayer(table.id, name)).player);
  }

  const draw = (await addZone(table.id, { name: "Draw" })).zone;
  const burn = (await addZone(table.id, { name: "Burn" })).zone;
  const board = (await addZone(table.id, { name: "Board" })).zone;
  const hands = [];

  for (const player of players) {
    hands.push((await addZone(table.id, { name: `${player.name} Hand`, ownerPlayerId: player.id })).zone);
  }

  const deckResponse = await addDeck(table.id, draw.id);
  const originalDeckIds = zoneByName(deckResponse.table, "Draw").cards.map((card) => card.id);

  const dealPrivateCards = await api("POST", `/tables/${table.id}/deal`, {
    fromZoneId: draw.id,
    toZoneIds: hands.map((hand) => hand.id),
    cardsPerTarget: 2,
    from: "top",
    to: "bottom",
    actorPlayerId: players[0]!.id,
  });

  expect(dealPrivateCards.status).toBe(200);

  await burnCards(table.id, draw.id, burn.id, players[0]!.id);
  await moveToBoard(table.id, draw.id, board.id, 3, players[0]!.id);
  await flipFromBoard(table.id, board.id, 3, "top", players[0]!.id);
  await burnCards(table.id, draw.id, burn.id, players[0]!.id);
  await moveToBoard(table.id, draw.id, board.id, 1, players[0]!.id);
  await flipFromBoard(table.id, board.id, 1, "bottom", players[0]!.id);
  await burnCards(table.id, draw.id, burn.id, players[0]!.id);
  await moveToBoard(table.id, draw.id, board.id, 1, players[0]!.id);
  await flipFromBoard(table.id, board.id, 1, "bottom", players[0]!.id);

  const publicTable = await getTable(table.id);
  const aliceView = await getTable(table.id, players[0]!.id);
  const publicDraw = zoneByName(publicTable, "Draw");
  const publicBurn = zoneByName(publicTable, "Burn");
  const publicBoard = zoneByName(publicTable, "Board");

  for (const player of players) {
    expect(zoneByName(publicTable, `${player.name} Hand`).count).toBe(2);
  }

  expect(publicBoard.count).toBe(5);
  expect(publicBurn.count).toBe(3);
  expect(publicDraw.count).toBe(34);
  expect([...allCardIds(publicTable)].sort()).toEqual([...originalDeckIds].sort());
  expect(new Set(allCardIds(publicTable)).size).toBe(52);

  expect(zoneByName(aliceView, "Alice Hand").cards.every((card) => card.unknown === false && card.code !== undefined)).toBe(
    true,
  );
  expect(zoneByName(aliceView, "Ben Hand").cards.every((card) => card.unknown === true && card.code === undefined)).toBe(
    true,
  );
  expect(publicBoard.cards.every((card) => card.unknown === false && card.face === "up" && card.code !== undefined)).toBe(
    true,
  );
  expect(publicBurn.cards.every((card) => card.unknown === true && card.face === "down" && card.code === undefined)).toBe(
    true,
  );
});

test("acceptance: 4 players can physically deal 鋤大弟 through the generic API", async () => {
  const table = await createTable("鋤大弟 table");
  const players = [];

  for (const name of ["North", "East", "South", "West"]) {
    players.push((await addPlayer(table.id, name)).player);
  }

  const draw = (await addZone(table.id, { name: "Draw" })).zone;
  const hands = [];

  for (const player of players) {
    hands.push((await addZone(table.id, { name: `${player.name} Hand`, ownerPlayerId: player.id })).zone);
  }

  const deckResponse = await addDeck(table.id, draw.id);
  const originalDeckIds = zoneByName(deckResponse.table, "Draw").cards.map((card) => card.id);
  const dealResponse = await api("POST", `/tables/${table.id}/deal`, {
    fromZoneId: draw.id,
    toZoneIds: hands.map((hand) => hand.id),
    cardsPerTarget: 13,
    from: "top",
    to: "bottom",
    actorPlayerId: players[0]!.id,
  });

  expect(dealResponse.status).toBe(200);

  const publicTable = await getTable(table.id);
  const northView = await getTable(table.id, players[0]!.id);

  for (const player of players) {
    expect(zoneByName(publicTable, `${player.name} Hand`).count).toBe(13);
  }

  expect(zoneByName(publicTable, "Draw").count).toBe(0);
  expect([...allCardIds(publicTable)].sort()).toEqual([...originalDeckIds].sort());
  expect(new Set(allCardIds(publicTable)).size).toBe(52);
  expect(zoneByName(northView, "North Hand").cards.every((card) => card.unknown === false && card.code !== undefined)).toBe(
    true,
  );
  expect(zoneByName(northView, "East Hand").cards.every((card) => card.unknown === true && card.code === undefined)).toBe(
    true,
  );
});

async function burnCards(tableId: string, drawZoneId: string, burnZoneId: string, actorPlayerId: string): Promise<void> {
  const response = await api("POST", `/tables/${tableId}/move`, {
    fromZoneId: drawZoneId,
    toZoneId: burnZoneId,
    selection: { type: "zoneCount", zoneId: drawZoneId, count: 1, from: "top" },
    to: "bottom",
    actorPlayerId,
  });

  expect(response.status).toBe(200);
}

async function moveToBoard(
  tableId: string,
  drawZoneId: string,
  boardZoneId: string,
  count: number,
  actorPlayerId: string,
): Promise<void> {
  const response = await api("POST", `/tables/${tableId}/move`, {
    fromZoneId: drawZoneId,
    toZoneId: boardZoneId,
    selection: { type: "zoneCount", zoneId: drawZoneId, count, from: "top" },
    to: "bottom",
    actorPlayerId,
  });

  expect(response.status).toBe(200);
}

async function flipFromBoard(
  tableId: string,
  boardZoneId: string,
  count: number,
  from: "top" | "bottom",
  actorPlayerId: string,
): Promise<void> {
  const response = await api("POST", `/tables/${tableId}/flip`, {
    selection: { type: "zoneCount", zoneId: boardZoneId, count, from },
    face: "up",
    actorPlayerId,
  });

  expect(response.status).toBe(200);
}
