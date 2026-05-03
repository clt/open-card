import { expect } from "bun:test";
import { handleRequest } from "../src/http/router";

export type ProjectedCard = {
  id: string;
  code?: string;
  face: "up" | "down";
  unknown: boolean;
};

export type ProjectedZone = {
  id: string;
  name: string;
  ownerPlayerId?: string;
  count: number;
  cards: ProjectedCard[];
};

export type ProjectedPlayer = {
  id: string;
  name: string;
};

export type ProjectedTable = {
  id: string;
  players: ProjectedPlayer[];
  zones: ProjectedZone[];
};

export async function api(method: string, path: string, body?: unknown): Promise<Response> {
  return handleRequest(
    new Request(`http://open-card.test${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function createTable(name = "Test table"): Promise<ProjectedTable> {
  const response = await api("POST", "/tables", { name });
  expect(response.status).toBe(201);
  return json<ProjectedTable>(response);
}

export async function addPlayer(tableId: string, name: string) {
  const response = await api("POST", `/tables/${tableId}/players`, { name });
  expect(response.status).toBe(201);
  return json<{ player: ProjectedPlayer; table: ProjectedTable }>(response);
}

export async function addZone(
  tableId: string,
  input: {
    name: string;
    ownerPlayerId?: string;
    defaultVisibility?: unknown;
  },
) {
  const response = await api("POST", `/tables/${tableId}/zones`, input);
  expect(response.status).toBe(201);
  return json<{ zone: ProjectedZone; table: ProjectedTable }>(response);
}

export async function addDeck(tableId: string, zoneId: string) {
  const response = await api("POST", `/tables/${tableId}/decks`, { zoneId });
  expect(response.status).toBe(200);
  return json<{ cardsAdded: number; table: ProjectedTable }>(response);
}

export async function getTable(tableId: string, viewerPlayerId?: string): Promise<ProjectedTable> {
  const path = viewerPlayerId === undefined ? `/tables/${tableId}` : `/tables/${tableId}?viewerPlayerId=${viewerPlayerId}`;
  const response = await api("GET", path);
  expect(response.status).toBe(200);
  return json<ProjectedTable>(response);
}

export function zoneByName(table: ProjectedTable, name: string): ProjectedZone {
  const zone = table.zones.find((candidate) => candidate.name === name);
  expect(zone).toBeDefined();
  return zone!;
}

export function allCardIds(table: ProjectedTable): string[] {
  return table.zones.flatMap((zone) => zone.cards.map((card) => card.id));
}
