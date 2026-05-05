/// <reference lib="dom" />

import type { KnownCard } from "./big2";

export type Player = {
  id: string;
  name: string;
  createdAt: string;
};

export type ProjectedCard =
  | (KnownCard & {
      label: string;
      face: "up" | "down";
      unknown: false;
    })
  | {
      id: string;
      face: "up" | "down";
      unknown: true;
    };

export type ProjectedZone = {
  id: string;
  name: string;
  ownerPlayerId?: string;
  defaultVisibility: unknown;
  count: number;
  cards: ProjectedCard[];
};

export type ProjectedTable = {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  dealer: {
    actor: { type: "player"; playerId: string } | { type: "nonPlayer"; name: string } | null;
    positionPlayerId: string | null;
  };
  players: Player[];
  zones: ProjectedZone[];
};

export type ApiLogEntry = {
  id: number;
  method: string;
  path: string;
  status?: number;
  ok?: boolean;
  detail?: string;
};

export class OpenCardApi {
  private static nextLogId = 1;

  constructor(
    private readonly baseUrl: string,
    private readonly onLog: (entry: ApiLogEntry) => void,
  ) {}

  async health(): Promise<{ ok: boolean }> {
    return this.request("GET", "/health");
  }

  async createTable(name: string): Promise<ProjectedTable> {
    return this.request("POST", "/tables", { name });
  }

  async addPlayer(tableId: string, name: string): Promise<{ player: Player; table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/players`, { name });
  }

  async setDealer(
    tableId: string,
    body: {
      actor?: { type: "nonPlayer"; name: string } | { type: "player"; playerId: string } | null;
      positionPlayerId?: string | null;
      actorPlayerId?: string;
    },
  ): Promise<{ dealer: ProjectedTable["dealer"]; table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/dealer`, body);
  }

  async createZone(
    tableId: string,
    body: {
      name: string;
      ownerPlayerId?: string;
      defaultVisibility?: "none" | "everyone" | { type: "owner" };
    },
  ): Promise<{ zone: ProjectedZone; table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/zones`, body);
  }

  async addDeck(tableId: string, zoneId: string, actorPlayerId?: string): Promise<{ cardsAdded: number; table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/decks`, { zoneId, actorPlayerId });
  }

  async shuffleZone(tableId: string, zoneId: string, actorPlayerId?: string): Promise<{ table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/zones/${zoneId}/shuffle`, { actorPlayerId });
  }

  async dealCards(
    tableId: string,
    body: {
      fromZoneId: string;
      toZoneIds: string[];
      cardsPerTarget: number;
      from: "top" | "bottom";
      to: "top" | "bottom";
      actorPlayerId?: string;
    },
  ): Promise<{ cardIds: string[]; table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/deal`, body);
  }

  async moveCards(
    tableId: string,
    body: {
      fromZoneId: string;
      toZoneId: string;
      selection: { type: "count"; count: number; from: "top" | "bottom" } | { type: "cardIds"; cardIds: string[] };
      to: "top" | "bottom";
      actorPlayerId?: string;
    },
  ): Promise<{ cardIds: string[]; table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/move`, body);
  }

  async flipCards(
    tableId: string,
    body: {
      selection: { type: "cardIds"; cardIds: string[] } | { type: "zoneCount"; zoneId: string; count: number; from: "top" | "bottom" };
      face: "up" | "down";
      actorPlayerId?: string;
    },
  ): Promise<{ cardIds: string[]; table: ProjectedTable }> {
    return this.request("POST", `/tables/${tableId}/flip`, body);
  }

  async getTable(tableId: string, viewerPlayerId?: string): Promise<ProjectedTable> {
    const query = viewerPlayerId === undefined ? "" : `?viewerPlayerId=${encodeURIComponent(viewerPlayerId)}`;
    return this.request("GET", `/tables/${tableId}${query}`);
  }

  async getEvents(tableId: string): Promise<{ events: Array<{ id: string; type: string; summary: string; createdAt: string }> }> {
    return this.request("GET", `/tables/${tableId}/events`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const started = OpenCardApi.nextLogId;
    OpenCardApi.nextLogId += 1;
    this.onLog({ id: started, method, path });

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const detail = text.length > 0 ? text : response.statusText;
    this.onLog({ id: started, method, path, status: response.status, ok: response.ok, detail });

    if (!response.ok) {
      throw new Error(readErrorMessage(detail, response.status));
    }

    return (text.length === 0 ? {} : JSON.parse(text)) as T;
  }
}

function readErrorMessage(detail: string, status: number): string {
  try {
    const parsed = JSON.parse(detail) as { error?: string };
    return parsed.error ?? `Open Card API request failed with ${status}.`;
  } catch {
    return `Open Card API request failed with ${status}.`;
  }
}
