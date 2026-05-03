import type { Card, CardVisibility } from "./card";
import type { EventType, TableEvent } from "./events";

export type DefaultVisibility =
  | { type: "none" }
  | { type: "everyone" }
  | { type: "owner" }
  | { type: "players"; playerIds: string[] };

export type Player = {
  id: string;
  name: string;
  createdAt: string;
};

export type DealerActor =
  | { type: "player"; playerId: string }
  | { type: "nonPlayer"; name: string };

export type DealerState = {
  actor: DealerActor | null;
  positionPlayerId: string | null;
};

export type Zone = {
  id: string;
  name: string;
  ownerPlayerId?: string;
  defaultVisibility: DefaultVisibility;
  cardIds: string[];
  createdAt: string;
};

export type Table = {
  id: string;
  name?: string;
  players: Record<string, Player>;
  dealer: DealerState;
  zones: Record<string, Zone>;
  cards: Record<string, Card>;
  events: TableEvent[];
  createdAt: string;
  updatedAt: string;
  sequence: {
    players: number;
    zones: number;
    cards: number;
    events: number;
  };
};

export function createTable(input: { name?: string } = {}): Table {
  const now = new Date().toISOString();
  const table: Table = {
    id: `table_${crypto.randomUUID()}`,
    name: input.name,
    players: {},
    dealer: { actor: null, positionPlayerId: null },
    zones: {},
    cards: {},
    events: [],
    createdAt: now,
    updatedAt: now,
    sequence: {
      players: 0,
      zones: 0,
      cards: 0,
      events: 0,
    },
  };

  appendEvent(table, {
    type: "table.created",
    summary: input.name ? `Table ${input.name} created.` : "Table created.",
  });

  return table;
}

export function nextPlayerId(table: Table): string {
  table.sequence.players += 1;
  return `player_${table.sequence.players}`;
}

export function nextZoneId(table: Table): string {
  table.sequence.zones += 1;
  return `zone_${table.sequence.zones}`;
}

export function nextCardId(table: Table): string {
  table.sequence.cards += 1;
  return `card_${table.sequence.cards}`;
}

export function appendEvent(
  table: Table,
  input: {
    type: EventType;
    summary: string;
    actorPlayerId?: string;
    metadata?: Record<string, unknown>;
  },
): TableEvent {
  table.sequence.events += 1;
  const event: TableEvent = {
    id: `event_${table.sequence.events}`,
    type: input.type,
    actorPlayerId: input.actorPlayerId,
    createdAt: new Date().toISOString(),
    summary: input.summary,
    metadata: input.metadata,
  };

  table.events.push(event);
  touch(table);
  return event;
}

export function touch(table: Table): void {
  table.updatedAt = new Date().toISOString();
}

export function defaultVisibilityForZone(input: {
  ownerPlayerId?: string;
  defaultVisibility?: DefaultVisibility;
}): DefaultVisibility {
  if (input.defaultVisibility !== undefined) {
    return input.defaultVisibility;
  }

  return input.ownerPlayerId === undefined ? { type: "none" } : { type: "owner" };
}

export function visibilityFromZone(zone: Zone): CardVisibility {
  switch (zone.defaultVisibility.type) {
    case "none":
      return { everyone: false, playerIds: [] };
    case "everyone":
      return { everyone: true, playerIds: [] };
    case "owner":
      return {
        everyone: false,
        playerIds: zone.ownerPlayerId === undefined ? [] : [zone.ownerPlayerId],
      };
    case "players":
      return {
        everyone: false,
        playerIds: [...zone.defaultVisibility.playerIds],
      };
  }
}
