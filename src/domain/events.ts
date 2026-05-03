export type EventType =
  | "table.created"
  | "player.joined"
  | "dealer.updated"
  | "dealer.passed"
  | "zone.created"
  | "deck.added"
  | "zone.shuffled"
  | "zone.cut"
  | "cards.moved"
  | "cards.dealt"
  | "cards.flipped"
  | "cards.revealed"
  | "cards.hidden";

export type TableEvent = {
  id: string;
  type: EventType;
  actorPlayerId?: string;
  createdAt: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type PublicEvent = Pick<TableEvent, "id" | "type" | "actorPlayerId" | "createdAt" | "summary">;

export function publicEvents(events: TableEvent[]): PublicEvent[] {
  return events.map(({ id, type, actorPlayerId, createdAt, summary }) => ({
    id,
    type,
    actorPlayerId,
    createdAt,
    summary,
  }));
}
