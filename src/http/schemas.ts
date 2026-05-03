import { z } from "zod";

const idSchema = z.string().trim().min(1);

export const createTableSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    name: z.string().trim().min(1).max(120).optional(),
  }),
);

export const addPlayerSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const dealerActorSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("player"),
    playerId: idSchema,
  }),
  z.object({
    type: z.literal("nonPlayer"),
    name: z.string().trim().min(1).max(80),
  }),
]);

export const setDealerSchema = z
  .object({
    actor: dealerActorSchema.nullable().optional(),
    positionPlayerId: idSchema.nullable().optional(),
    actorPlayerId: idSchema.optional(),
  })
  .refine((value) => value.actor !== undefined || value.positionPlayerId !== undefined, {
    message: "Dealer update requires actor or positionPlayerId.",
  });

export const passDealerSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    direction: z.enum(["next", "previous"]).default("next"),
    actorPlayerId: idSchema.optional(),
  }),
);

const defaultVisibilitySchema = z.union([
  z.literal("none").transform(() => ({ type: "none" as const })),
  z.literal("everyone").transform(() => ({ type: "everyone" as const })),
  z.object({ type: z.literal("owner") }),
  z.object({
    type: z.literal("players"),
    playerIds: z.array(idSchema).min(1),
  }),
]);

export const createZoneSchema = z.object({
  name: z.string().trim().min(1).max(120),
  ownerPlayerId: idSchema.optional(),
  defaultVisibility: defaultVisibilitySchema.optional(),
});

export const addDeckSchema = z.object({
  zoneId: idSchema,
  actorPlayerId: idSchema.optional(),
});

export const shuffleZoneSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    actorPlayerId: idSchema.optional(),
  }),
);

export const cutZoneSchema = z.object({
  at: z.number().int().min(0),
  actorPlayerId: idSchema.optional(),
});

const countMoveSelectionSchema = z.object({
  type: z.literal("count"),
  count: z.number().int().min(1),
  from: z.enum(["top", "bottom"]).default("top"),
});

const cardIdsSelectionSchema = z.object({
  type: z.literal("cardIds"),
  cardIds: z.array(idSchema).min(1),
});

const zoneCountSelectionSchema = z.object({
  type: z.literal("zoneCount"),
  zoneId: idSchema,
  count: z.number().int().min(1),
  from: z.enum(["top", "bottom"]).default("top"),
});

export const moveCardsSchema = z.object({
  fromZoneId: idSchema,
  toZoneId: idSchema,
  selection: z.discriminatedUnion("type", [countMoveSelectionSchema, cardIdsSelectionSchema]),
  to: z.enum(["top", "bottom"]).default("bottom"),
  actorPlayerId: idSchema.optional(),
});

export const dealCardsSchema = z.object({
  fromZoneId: idSchema,
  toZoneIds: z.array(idSchema).min(1),
  cardsPerTarget: z.number().int().min(1),
  from: z.enum(["top", "bottom"]).default("top"),
  to: z.enum(["top", "bottom"]).default("bottom"),
  actorPlayerId: idSchema.optional(),
});

export const cardSelectionSchema = z.discriminatedUnion("type", [cardIdsSelectionSchema, zoneCountSelectionSchema]);

export const flipCardsSchema = z.object({
  selection: cardSelectionSchema,
  face: z.enum(["up", "down"]),
  actorPlayerId: idSchema.optional(),
});

export const revealCardsSchema = z.object({
  selection: cardSelectionSchema,
  to: z.union([
    z.literal("everyone"),
    z.object({
      playerIds: z.array(idSchema).min(1),
    }),
  ]),
  actorPlayerId: idSchema.optional(),
});

export const hideCardsSchema = z.object({
  selection: cardSelectionSchema,
  from: z.union([
    z.literal("all"),
    z.literal("everyone"),
    z.object({
      playerIds: z.array(idSchema).min(1),
    }),
  ]),
  actorPlayerId: idSchema.optional(),
});
