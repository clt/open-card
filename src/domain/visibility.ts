import type { Card } from "./card";
import type { Table, Zone } from "./table";

export type ProjectedCard =
  | {
      id: string;
      code: string;
      rank: string;
      suit: string;
      label: string;
      face: "up" | "down";
      unknown: false;
    }
  | {
      id: string;
      face: "up" | "down";
      unknown: true;
    };

export type ProjectedTable = {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  players: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  zones: Array<{
    id: string;
    name: string;
    ownerPlayerId?: string;
    defaultVisibility: Zone["defaultVisibility"];
    count: number;
    cards: ProjectedCard[];
  }>;
};

export function projectTable(table: Table, viewerPlayerId?: string): ProjectedTable {
  return {
    id: table.id,
    name: table.name,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
    players: Object.values(table.players),
    zones: Object.values(table.zones).map((zone) => ({
      id: zone.id,
      name: zone.name,
      ownerPlayerId: zone.ownerPlayerId,
      defaultVisibility: zone.defaultVisibility,
      count: zone.cardIds.length,
      cards: zone.cardIds.map((cardId) => projectCard(table.cards[cardId]!, viewerPlayerId)),
    })),
  };
}

export function projectCard(card: Card, viewerPlayerId?: string): ProjectedCard {
  if (canSeeCard(card, viewerPlayerId)) {
    return {
      id: card.id,
      code: card.code,
      rank: card.rank,
      suit: card.suit,
      label: card.label,
      face: card.face,
      unknown: false,
    };
  }

  return {
    id: card.id,
    face: card.face,
    unknown: true,
  };
}

export function canSeeCard(card: Card, viewerPlayerId?: string): boolean {
  if (card.face === "up" || card.visibility.everyone) {
    return true;
  }

  return viewerPlayerId !== undefined && card.visibility.playerIds.includes(viewerPlayerId);
}
