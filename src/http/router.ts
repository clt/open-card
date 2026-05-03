import { z } from "zod";
import { DomainError } from "../domain/errors";
import {
  addPlayer,
  addStandardDeck,
  createZone,
  cutZone,
  dealCards,
  flipCards,
  hideCards,
  moveCards,
  passDealerPosition,
  revealCards,
  setDealer,
  shuffleZone,
} from "../domain/operations";
import { createTable } from "../domain/table";
import { publicEvents } from "../domain/events";
import { projectTable } from "../domain/visibility";
import type { TableStore } from "../store/memoryStore";
import { memoryStore } from "../store/memoryStore";
import { acceptanceResultsPage } from "./pages";
import { corsHeaders, handleError, html, json, notFoundResponse } from "./responses";
import {
  addDeckSchema,
  addPlayerSchema,
  createTableSchema,
  createZoneSchema,
  cutZoneSchema,
  dealCardsSchema,
  flipCardsSchema,
  hideCardsSchema,
  moveCardsSchema,
  passDealerSchema,
  revealCardsSchema,
  setDealerSchema,
  shuffleZoneSchema,
} from "./schemas";

export function createRouter(store: TableStore = memoryStore) {
  return async function handleRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/") {
        return html(acceptanceResultsPage());
      }

      if (segments.length === 1 && segments[0] === "tables" && request.method === "POST") {
        const body = await parseBody(request, createTableSchema);
        const table = store.create(createTable(body));
        return json(projectTable(table), 201);
      }

      if (segments.length === 1 && segments[0] === "tables" && request.method === "GET") {
        return json({
          tables: store.list().map((table) => ({
            id: table.id,
            name: table.name,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt,
          })),
        });
      }

      if (segments[0] !== "tables" || segments[1] === undefined) {
        return notFoundResponse();
      }

      const table = store.require(segments[1]);

      if (segments.length === 2 && request.method === "GET") {
        return json(projectTable(table, url.searchParams.get("viewerPlayerId") ?? undefined));
      }

      if (segments.length === 3 && segments[2] === "events" && request.method === "GET") {
        return json({ events: publicEvents(table.events) });
      }

      if (request.method !== "POST") {
        return notFoundResponse();
      }

      if (segments.length === 3 && segments[2] === "players") {
        const body = await parseBody(request, addPlayerSchema);
        const player = addPlayer(table, body);
        return json({ player, table: projectTable(table, player.id) }, 201);
      }

      if (segments.length === 3 && segments[2] === "zones") {
        const body = await parseBody(request, createZoneSchema);
        const zone = createZone(table, body);
        return json({ zone, table: projectTable(table, zone.ownerPlayerId) }, 201);
      }

      if (segments.length === 3 && segments[2] === "decks") {
        const body = await parseBody(request, addDeckSchema);
        addStandardDeck(table, body);
        return json({ cardsAdded: 52, table: projectTable(table, body.actorPlayerId) });
      }

      if (segments.length === 3 && segments[2] === "dealer") {
        const body = await parseBody(request, setDealerSchema);
        const dealer = setDealer(table, body);
        return json({ dealer, table: projectTable(table, body.actorPlayerId) });
      }

      if (segments.length === 4 && segments[2] === "dealer" && segments[3] === "pass") {
        const body = await parseBody(request, passDealerSchema);
        const dealer = passDealerPosition(table, body);
        return json({ dealer, table: projectTable(table, body.actorPlayerId) });
      }

      if (segments.length === 5 && segments[2] === "zones" && segments[3] !== undefined) {
        if (segments[4] === "shuffle") {
          const body = await parseBody(request, shuffleZoneSchema);
          shuffleZone(table, { zoneId: segments[3], actorPlayerId: body.actorPlayerId });
          return json({ table: projectTable(table, body.actorPlayerId) });
        }

        if (segments[4] === "cut") {
          const body = await parseBody(request, cutZoneSchema);
          cutZone(table, { zoneId: segments[3], at: body.at, actorPlayerId: body.actorPlayerId });
          return json({ table: projectTable(table, body.actorPlayerId) });
        }
      }

      if (segments.length === 3 && segments[2] === "move") {
        const body = await parseBody(request, moveCardsSchema);
        const cardIds = moveCards(table, body);
        return json({ cardIds, table: projectTable(table, body.actorPlayerId) });
      }

      if (segments.length === 3 && segments[2] === "deal") {
        const body = await parseBody(request, dealCardsSchema);
        const cardIds = dealCards(table, body);
        return json({ cardIds, table: projectTable(table, body.actorPlayerId) });
      }

      if (segments.length === 3 && segments[2] === "flip") {
        const body = await parseBody(request, flipCardsSchema);
        const cardIds = flipCards(table, body);
        return json({ cardIds, table: projectTable(table, body.actorPlayerId) });
      }

      if (segments.length === 3 && segments[2] === "reveal") {
        const body = await parseBody(request, revealCardsSchema);
        const cardIds = revealCards(table, body);
        return json({ cardIds, table: projectTable(table, body.actorPlayerId) });
      }

      if (segments.length === 3 && segments[2] === "hide") {
        const body = await parseBody(request, hideCardsSchema);
        const cardIds = hideCards(table, body);
        return json({ cardIds, table: projectTable(table, body.actorPlayerId) });
      }

      return notFoundResponse();
    } catch (error) {
      return handleError(error);
    }
  };
}

export const handleRequest = createRouter(memoryStore);

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await request.text();

  if (text.trim().length === 0) {
    return schema.parse(undefined);
  }

  try {
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new DomainError(400, "Request body must be valid JSON.");
    }

    throw error;
  }
}
