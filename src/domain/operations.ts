import { cloneVisibility, createStandardDeck } from "./card";
import type { Face } from "./card";
import { badRequest, conflict, notFound } from "./errors";
import {
  appendEvent,
  defaultVisibilityForZone,
  nextCardId,
  nextPlayerId,
  nextZoneId,
  visibilityFromZone,
} from "./table";
import type { DealerActor, DealerState, DefaultVisibility, Player, Table, Zone } from "./table";

export type CardSelection =
  | {
      type: "cardIds";
      cardIds: string[];
    }
  | {
      type: "zoneCount";
      zoneId: string;
      count: number;
      from: "top" | "bottom";
    };

export function addPlayer(table: Table, input: { name: string }): Player {
  const player: Player = {
    id: nextPlayerId(table),
    name: input.name,
    createdAt: new Date().toISOString(),
  };

  table.players[player.id] = player;
  appendEvent(table, {
    type: "player.joined",
    summary: `${player.name} joined table.`,
    metadata: { playerId: player.id },
  });

  return player;
}

export function setDealer(
  table: Table,
  input: {
    actor?: DealerActor | null;
    positionPlayerId?: string | null;
    actorPlayerId?: string;
  },
): DealerState {
  validateActor(table, input.actorPlayerId);

  if (input.actor === undefined && input.positionPlayerId === undefined) {
    badRequest("Dealer update requires actor or positionPlayerId.");
  }

  const actor = input.actor === undefined ? table.dealer.actor : validateDealerActor(table, input.actor);
  const positionPlayerId =
    input.positionPlayerId === undefined ? table.dealer.positionPlayerId : validateDealerPosition(table, input.positionPlayerId);

  table.dealer = { actor, positionPlayerId };
  appendEvent(table, {
    type: "dealer.updated",
    actorPlayerId: input.actorPlayerId,
    summary: "Dealer updated.",
    metadata: { dealer: table.dealer },
  });

  return table.dealer;
}

export function passDealerPosition(
  table: Table,
  input: {
    direction?: "next" | "previous";
    actorPlayerId?: string;
  } = {},
): DealerState {
  validateActor(table, input.actorPlayerId);

  const currentPositionPlayerId = table.dealer.positionPlayerId;

  if (currentPositionPlayerId === null) {
    conflict("Dealer position is not set.");
  }

  const players = Object.values(table.players);
  const currentIndex = players.findIndex((player) => player.id === currentPositionPlayerId);

  if (currentIndex === -1) {
    notFound(`Player ${currentPositionPlayerId} not found.`);
  }

  const direction = input.direction ?? "next";
  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = (currentIndex + offset + players.length) % players.length;
  const currentPlayer = players[currentIndex]!;
  const nextPlayer = players[nextIndex]!;

  table.dealer = { ...table.dealer, positionPlayerId: nextPlayer.id };
  appendEvent(table, {
    type: "dealer.passed",
    actorPlayerId: input.actorPlayerId,
    summary: `Dealer position passed from ${currentPlayer.name} to ${nextPlayer.name}.`,
    metadata: {
      direction,
      fromPlayerId: currentPlayer.id,
      toPlayerId: nextPlayer.id,
    },
  });

  return table.dealer;
}

export function createZone(
  table: Table,
  input: {
    name: string;
    ownerPlayerId?: string;
    defaultVisibility?: DefaultVisibility;
  },
): Zone {
  if (input.ownerPlayerId !== undefined) {
    requirePlayer(table, input.ownerPlayerId);
  }

  validateDefaultVisibilityPlayers(table, input.defaultVisibility);

  const zone: Zone = {
    id: nextZoneId(table),
    name: input.name,
    ownerPlayerId: input.ownerPlayerId,
    defaultVisibility: defaultVisibilityForZone(input),
    cardIds: [],
    createdAt: new Date().toISOString(),
  };

  table.zones[zone.id] = zone;
  appendEvent(table, {
    type: "zone.created",
    actorPlayerId: input.ownerPlayerId,
    summary: `Zone ${zone.name} created.`,
    metadata: { zoneId: zone.id, ownerPlayerId: zone.ownerPlayerId },
  });

  return zone;
}

export function addStandardDeck(
  table: Table,
  input: {
    zoneId: string;
    actorPlayerId?: string;
  },
): void {
  validateActor(table, input.actorPlayerId);
  const zone = requireZone(table, input.zoneId);
  const deck = createStandardDeck(() => nextCardId(table));

  for (const card of deck) {
    table.cards[card.id] = card;
    zone.cardIds.push(card.id);
  }

  appendEvent(table, {
    type: "deck.added",
    actorPlayerId: input.actorPlayerId,
    summary: `Added ${deck.length} cards to ${zone.name}.`,
    metadata: { zoneId: zone.id, cardIds: deck.map((card) => card.id) },
  });
}

export function shuffleZone(
  table: Table,
  input: {
    zoneId: string;
    actorPlayerId?: string;
  },
): void {
  validateActor(table, input.actorPlayerId);
  const zone = requireZone(table, input.zoneId);

  zone.cardIds = shuffle(zone.cardIds);
  appendEvent(table, {
    type: "zone.shuffled",
    actorPlayerId: input.actorPlayerId,
    summary: `Shuffled ${zone.name}.`,
    metadata: { zoneId: zone.id },
  });
}

export function cutZone(
  table: Table,
  input: {
    zoneId: string;
    at: number;
    actorPlayerId?: string;
  },
): void {
  validateActor(table, input.actorPlayerId);
  const zone = requireZone(table, input.zoneId);

  if (input.at < 0 || input.at > zone.cardIds.length) {
    badRequest(`Cut position must be between 0 and ${zone.cardIds.length}.`);
  }

  zone.cardIds = [...zone.cardIds.slice(input.at), ...zone.cardIds.slice(0, input.at)];
  appendEvent(table, {
    type: "zone.cut",
    actorPlayerId: input.actorPlayerId,
    summary: `Cut ${zone.name}.`,
    metadata: { zoneId: zone.id, at: input.at },
  });
}

export function moveCards(
  table: Table,
  input: {
    fromZoneId: string;
    toZoneId: string;
    selection: CardSelection;
    to: "top" | "bottom";
    actorPlayerId?: string;
  },
): string[] {
  validateActor(table, input.actorPlayerId);
  const movedCardIds = moveCardsInternal(table, input);
  const fromZone = requireZone(table, input.fromZoneId);
  const toZone = requireZone(table, input.toZoneId);

  appendEvent(table, {
    type: "cards.moved",
    actorPlayerId: input.actorPlayerId,
    summary: `Moved ${movedCardIds.length} ${cardWord(movedCardIds.length)} from ${fromZone.name} to ${toZone.name}.`,
    metadata: {
      fromZoneId: input.fromZoneId,
      toZoneId: input.toZoneId,
      cardIds: movedCardIds,
    },
  });

  return movedCardIds;
}

export function dealCards(
  table: Table,
  input: {
    fromZoneId: string;
    toZoneIds: string[];
    cardsPerTarget: number;
    from: "top" | "bottom";
    to: "top" | "bottom";
    actorPlayerId?: string;
  },
): string[] {
  validateActor(table, input.actorPlayerId);
  const fromZone = requireZone(table, input.fromZoneId);
  const targetZones = input.toZoneIds.map((zoneId) => requireZone(table, zoneId));
  const uniqueTargetZoneIds = new Set(input.toZoneIds);

  if (input.toZoneIds.length === 0) {
    badRequest("Deal requires at least one target zone.");
  }

  if (uniqueTargetZoneIds.size !== input.toZoneIds.length) {
    badRequest("Deal target zones must be unique.");
  }

  const totalCards = input.cardsPerTarget * input.toZoneIds.length;

  if (input.cardsPerTarget < 1) {
    badRequest("cardsPerTarget must be at least 1.");
  }

  if (fromZone.cardIds.length < totalCards) {
    conflict(`Cannot deal ${totalCards} cards from a zone with ${fromZone.cardIds.length} cards.`);
  }

  const movedCardIds: string[] = [];

  for (let round = 0; round < input.cardsPerTarget; round += 1) {
    for (const targetZone of targetZones) {
      movedCardIds.push(
        ...moveCardsInternal(table, {
          fromZoneId: input.fromZoneId,
          toZoneId: targetZone.id,
          selection: { type: "zoneCount", zoneId: input.fromZoneId, count: 1, from: input.from },
          to: input.to,
        }),
      );
    }
  }

  appendEvent(table, {
    type: "cards.dealt",
    actorPlayerId: input.actorPlayerId,
    summary: `Dealt ${movedCardIds.length} ${cardWord(movedCardIds.length)} from ${fromZone.name} to ${targetZones.length} zones.`,
    metadata: {
      fromZoneId: fromZone.id,
      toZoneIds: input.toZoneIds,
      cardIds: movedCardIds,
    },
  });

  return movedCardIds;
}

export function flipCards(
  table: Table,
  input: {
    selection: CardSelection;
    face: Face;
    actorPlayerId?: string;
  },
): string[] {
  validateActor(table, input.actorPlayerId);
  const cardIds = selectCards(table, input.selection);

  for (const cardId of cardIds) {
    table.cards[cardId]!.face = input.face;
  }

  appendEvent(table, {
    type: "cards.flipped",
    actorPlayerId: input.actorPlayerId,
    summary: `Flipped ${cardIds.length} ${cardWord(cardIds.length)} face ${input.face}.`,
    metadata: { cardIds, face: input.face },
  });

  return cardIds;
}

export function revealCards(
  table: Table,
  input: {
    selection: CardSelection;
    to: "everyone" | { playerIds: string[] };
    actorPlayerId?: string;
  },
): string[] {
  validateActor(table, input.actorPlayerId);
  const cardIds = selectCards(table, input.selection);

  if (input.to !== "everyone") {
    validatePlayerIds(table, input.to.playerIds);
  }

  for (const cardId of cardIds) {
    const card = table.cards[cardId]!;
    if (input.to === "everyone") {
      card.visibility.everyone = true;
    } else {
      card.visibility.playerIds = unique([...card.visibility.playerIds, ...input.to.playerIds]);
    }
  }

  appendEvent(table, {
    type: "cards.revealed",
    actorPlayerId: input.actorPlayerId,
    summary: `Revealed ${cardIds.length} ${cardWord(cardIds.length)}.`,
    metadata: { cardIds, to: input.to },
  });

  return cardIds;
}

export function hideCards(
  table: Table,
  input: {
    selection: CardSelection;
    from: "all" | "everyone" | { playerIds: string[] };
    actorPlayerId?: string;
  },
): string[] {
  validateActor(table, input.actorPlayerId);
  const cardIds = selectCards(table, input.selection);

  if (typeof input.from === "object") {
    validatePlayerIds(table, input.from.playerIds);
  }

  for (const cardId of cardIds) {
    const card = table.cards[cardId]!;

    if (input.from === "all") {
      card.visibility = { everyone: false, playerIds: [] };
    } else if (input.from === "everyone") {
      card.visibility.everyone = false;
    } else {
      const hiddenPlayerIds = new Set(input.from.playerIds);
      card.visibility.playerIds = card.visibility.playerIds.filter((playerId) => !hiddenPlayerIds.has(playerId));
    }
  }

  appendEvent(table, {
    type: "cards.hidden",
    actorPlayerId: input.actorPlayerId,
    summary: `Hid ${cardIds.length} ${cardWord(cardIds.length)}.`,
    metadata: { cardIds, from: input.from },
  });

  return cardIds;
}

function moveCardsInternal(
  table: Table,
  input: {
    fromZoneId: string;
    toZoneId: string;
    selection: CardSelection;
    to: "top" | "bottom";
  },
): string[] {
  const fromZone = requireZone(table, input.fromZoneId);
  const toZone = requireZone(table, input.toZoneId);
  const selectedCardIds = selectMoveCards(fromZone, input.selection);
  const selectedSet = new Set(selectedCardIds);
  const movedCards = selectedCardIds.map((cardId) => requireCard(table, cardId));
  const destinationVisibility = visibilityFromZone(toZone);

  fromZone.cardIds = fromZone.cardIds.filter((cardId) => !selectedSet.has(cardId));

  if (input.to === "top") {
    toZone.cardIds = [...selectedCardIds, ...toZone.cardIds];
  } else {
    toZone.cardIds = [...toZone.cardIds, ...selectedCardIds];
  }

  for (const card of movedCards) {
    card.visibility = cloneVisibility(destinationVisibility);
  }

  return selectedCardIds;
}

function selectMoveCards(zone: Zone, selection: CardSelection): string[] {
  if (selection.type === "zoneCount") {
    if (selection.zoneId !== zone.id) {
      badRequest("Selection zoneId must match fromZoneId.");
    }
    return selectFromZoneByCount(zone, selection.count, selection.from);
  }

  const uniqueCardIds = unique(selection.cardIds);

  if (uniqueCardIds.length !== selection.cardIds.length) {
    badRequest("cardIds must be unique.");
  }

  for (const cardId of selection.cardIds) {
    if (!zone.cardIds.includes(cardId)) {
      notFound(`Card ${cardId} was not found in ${zone.name}.`);
    }
  }

  return [...selection.cardIds];
}

function selectCards(table: Table, selection: CardSelection): string[] {
  if (selection.type === "zoneCount") {
    const zone = requireZone(table, selection.zoneId);
    return selectFromZoneByCount(zone, selection.count, selection.from);
  }

  const uniqueCardIds = unique(selection.cardIds);

  if (uniqueCardIds.length !== selection.cardIds.length) {
    badRequest("cardIds must be unique.");
  }

  for (const cardId of selection.cardIds) {
    requireCard(table, cardId);
  }

  return [...selection.cardIds];
}

function selectFromZoneByCount(zone: Zone, count: number, from: "top" | "bottom"): string[] {
  if (count < 1) {
    badRequest("Count must be at least 1.");
  }

  if (zone.cardIds.length < count) {
    conflict(`Cannot select ${count} cards from a zone with ${zone.cardIds.length} cards.`);
  }

  return from === "top" ? zone.cardIds.slice(0, count) : zone.cardIds.slice(zone.cardIds.length - count);
}

function requireZone(table: Table, zoneId: string): Zone {
  const zone = table.zones[zoneId];

  if (zone === undefined) {
    notFound(`Zone ${zoneId} not found.`);
  }

  return zone;
}

function requirePlayer(table: Table, playerId: string): Player {
  const player = table.players[playerId];

  if (player === undefined) {
    notFound(`Player ${playerId} not found.`);
  }

  return player;
}

function requireCard(table: Table, cardId: string) {
  const card = table.cards[cardId];

  if (card === undefined) {
    notFound(`Card ${cardId} not found.`);
  }

  return card;
}

function validateActor(table: Table, actorPlayerId?: string): void {
  if (actorPlayerId !== undefined) {
    requirePlayer(table, actorPlayerId);
  }
}

function validateDealerActor(table: Table, actor: DealerActor | null): DealerActor | null {
  if (actor?.type === "player") {
    requirePlayer(table, actor.playerId);
  }

  return actor;
}

function validateDealerPosition(table: Table, positionPlayerId: string | null): string | null {
  if (positionPlayerId !== null) {
    requirePlayer(table, positionPlayerId);
  }

  return positionPlayerId;
}

function validateDefaultVisibilityPlayers(table: Table, defaultVisibility?: DefaultVisibility): void {
  if (defaultVisibility?.type === "players") {
    validatePlayerIds(table, defaultVisibility.playerIds);
  }
}

function validatePlayerIds(table: Table, playerIds: string[]): void {
  if (unique(playerIds).length !== playerIds.length) {
    badRequest("playerIds must be unique.");
  }

  for (const playerId of playerIds) {
    requirePlayer(table, playerId);
  }
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function cardWord(count: number): string {
  return count === 1 ? "card" : "cards";
}
