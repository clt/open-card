## Project intent

Open Card is a virtual card table, not a card game server.

The system should simulate the physical behavior of cards around a table so humans can play arbitrary card games and enforce rules socially.

Build table physics, not game logic.

The server may model:

- tables
- players
- cards
- zones
- card movement
- card order
- shuffling
- cutting
- dealing
- flipping
- visibility
- permissions
- event logs

The server must not model:

- poker hand rankings
- blackjack bust rules
- following suit
- hearts being broken
- scoring for a specific game
- turn legality for a specific game
- any game-specific win condition

Humans create, negotiate, and enforce game rules.

## Architecture

Keep domain logic separate from HTTP.

Suggested structure:

```text
src/
  index.ts
  domain/
    card.ts
    deck.ts
    table.ts
    operations.ts
    visibility.ts
    events.ts
  store/
    memoryStore.ts
  http/
    router.ts
    responses.ts
    schemas.ts
test/
  deck.test.ts
  operations.test.ts
  visibility.test.ts
  events.test.ts
```

Domain functions should be pure where practical.

HTTP handlers should mostly:

1. parse input
2. validate input
3. call domain/store functions
4. return JSON responses

Storage should sit behind a simple interface so persistence can be swapped later.

Use in-memory storage for the MVP.

Do not add persistence, auth, Docker, deployment config, frontend UI, or realtime unless explicitly requested.

## Core entities

### Table

A shared room containing players, zones, cards, and events.

### Player

A participant at a table.

Players may have owned zones, such as hands.

### Zone

A named ordered collection of cards.

Examples:

- draw pile
- discard pile
- player hand
- tableau column
- trick area
- kitty
- market
- custom pile

Decks are just zones containing cards.

### Card

A unique physical card instance.

A card must have:

- `id`: unique physical card instance ID
- `code`: face code such as `AS`, `10H`, or `QD`
- `rank`
- `suit`
- `label`
- `face`: `up` or `down`
- visibility information

`id` and `code` are not the same thing.

If a table uses multiple decks, there may be multiple cards with `code: "AS"`, but each must have a unique `id`.

### Event

A record of a table action.

Events should support table history, debugging, and player-visible logs without leaking hidden card identities.

## Core invariants

- A `Card` represents a unique physical card instance
- `card.id` must be unique across the table
- `card.code` identifies card face value, such as `AS`, `10H`, or `QD`
- A deck is just a zone containing cards
- Zones preserve card order
- Moves must not duplicate cards
- Moves must not lose cards
- Moving cards by count should support top/bottom selection
- Moving cards by explicit card IDs should preserve requested order unless otherwise specified
- Shuffle must preserve the exact set of cards
- Cut must preserve the exact set of cards
- Deal is a convenience operation built from repeated card moves
- Hidden card identities must not be exposed to unauthorized viewers
- Event summaries must not leak hidden card identities
- Mutating operations should write event log entries

## Required MVP API

- `POST /tables`
- `GET /tables/:tableId`
- `POST /tables/:tableId/players`
- `POST /tables/:tableId/zones`
- `POST /tables/:tableId/decks`
- `POST /tables/:tableId/zones/:zoneId/shuffle`
- `POST /tables/:tableId/zones/:zoneId/cut`
- `POST /tables/:tableId/move`
- `POST /tables/:tableId/deal`
- `POST /tables/:tableId/flip`
- `POST /tables/:tableId/reveal`
- `POST /tables/:tableId/hide`
- `GET /tables/:tableId/events`

## Required MVP operations

Implement:

- create table
- get projected table state
- join table
- create zone
- add standard 52-card deck
- shuffle zone
- cut zone
- move cards between zones
- move cards by count from top/bottom
- move cards by explicit card IDs
- deal round-robin from one zone to multiple zones
- flip cards up/down
- reveal cards to specific players
- hide cards from specific players
- list event log

## Visibility

When returning table state, project the response for the viewer.

`GET /tables/:tableId` should accept a viewer/player parameter and return the table state as that viewer is allowed to see it.

Authorized viewers may see full card identity.

Unauthorized viewers must see hidden cards as unknown placeholders.

Example authorized card:

```json
{
  "id": "card_123",
  "code": "AS",
  "rank": "A",
  "suit": "spades",
  "label": "Ace of Spades",
  "face": "up",
  "unknown": false
}
```

Example unauthorized card:

```json
{
  "id": "card_123",
  "unknown": true
}
```

Visibility should support:

- visible to everyone
- visible to no one
- visible to owner
- visible to specific players

## Event log secrecy

Event summaries must preserve hidden information.

Good:

```text
Carl drew 1 card from Draw Pile.
```

Bad:

```text
Carl drew Ace of Spades from Draw Pile.
```

Good:

```text
Carl moved 2 cards from Hand to Discard Pile.
```

Bad:

```text
Carl discarded Ace of Spades and Seven of Hearts.
```

Internal event metadata may retain card IDs for debugging and tests, but public summaries must not leak hidden card identities.

## HTTP behavior

Use JSON request and response bodies.

Use Web-standard `Response` objects.

Return appropriate status codes:

- `200` for successful reads and normal mutations
- `201` for created resources
- `400` for invalid request bodies
- `404` for missing tables, zones, players, or cards
- `409` for invalid state transitions, such as moving more cards than exist
- `500` only for unexpected errors

Keep route handlers thin.

Validate request bodies with Zod where useful.

## Testing

Use `bun test`.

Add tests for:

- standard deck generation
- standard deck has 52 cards
- cards have expected ranks and suits
- unique physical card IDs
- multiple decks can contain duplicate card codes but not duplicate card IDs
- shuffle preserves all cards
- shuffle changes order when possible
- cut preserves all cards
- cut preserves order correctly
- move removes cards from source and appends to destination
- move by count supports top/bottom
- move by explicit card IDs preserves requested order
- move does not duplicate cards
- move does not lose cards
- deal round-robin distributes cards correctly
- flip updates card face state
- reveal updates visibility
- hide updates visibility
- visibility projection shows card identity to authorized viewers
- visibility projection hides card identity from unauthorized viewers
- event summaries do not leak hidden card identity
- mutating operations append event log entries

## Style

Prefer simple, readable code over clever abstractions.

Use explicit types for domain models.

Keep naming boring and clear.

Avoid premature generalization.

Do not introduce game-specific terminology unless it describes generic table mechanics.

Good generic terms:

- table
- player
- card
- zone
- pile
- hand
- deck
- draw
- discard
- move
- deal
- shuffle
- cut
- flip
- reveal
- hide

Avoid game-specific terms unless they are user-provided zone names:

- flop
- turn
- river
- hit
- stand
- bust
- trick winner
- follow suit
- hearts broken
- poker hand

