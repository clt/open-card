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
        return await actorMutation(request, addDeckSchema, table, (body) => {
          addStandardDeck(table, body);
          return { cardsAdded: 52 };
        });
      }

      if (segments.length === 3 && segments[2] === "dealer") {
        return await actorMutation(request, setDealerSchema, table, (body) => ({ dealer: setDealer(table, body) }));
      }

      if (segments.length === 4 && segments[2] === "dealer" && segments[3] === "pass") {
        return await actorMutation(request, passDealerSchema, table, (body) => ({ dealer: passDealerPosition(table, body) }));
      }

      if (segments.length === 5 && segments[2] === "zones" && segments[3] !== undefined) {
        if (segments[4] === "shuffle") {
          return await actorMutation(request, shuffleZoneSchema, table, (body) => {
            shuffleZone(table, { zoneId: segments[3]!, actorPlayerId: body.actorPlayerId });
          });
        }

        if (segments[4] === "cut") {
          return await actorMutation(request, cutZoneSchema, table, (body) => {
            cutZone(table, { zoneId: segments[3]!, at: body.at, actorPlayerId: body.actorPlayerId });
          });
        }
      }

      if (segments.length === 3 && segments[2] === "move") {
        return await actorMutation(request, moveCardsSchema, table, (body) => ({ cardIds: moveCards(table, body) }));
      }

      if (segments.length === 3 && segments[2] === "deal") {
        return await actorMutation(request, dealCardsSchema, table, (body) => ({ cardIds: dealCards(table, body) }));
      }

      if (segments.length === 3 && segments[2] === "flip") {
        return await actorMutation(request, flipCardsSchema, table, (body) => ({ cardIds: flipCards(table, body) }));
      }

      if (segments.length === 3 && segments[2] === "reveal") {
        return await actorMutation(request, revealCardsSchema, table, (body) => ({ cardIds: revealCards(table, body) }));
      }

      if (segments.length === 3 && segments[2] === "hide") {
        return await actorMutation(request, hideCardsSchema, table, (body) => ({ cardIds: hideCards(table, body) }));
      }

      return notFoundResponse();
    } catch (error) {
      return handleError(error);
    }
  };
}

export const handleRequest = createRouter(memoryStore);

async function actorMutation<T extends { actorPlayerId?: string }>(
  request: Request,
  schema: z.ZodType<T>,
  table: ReturnType<TableStore["require"]>,
  operate: (body: T) => Record<string, unknown> | undefined,
  status = 200,
): Promise<Response> {
  const body = await parseBody(request, schema);
  const extra = operate(body) ?? {};
  return json({ ...extra, table: projectTable(table, body.actorPlayerId) }, status);
}

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
