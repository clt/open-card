# Open Card

Open Card is a Bun API for a virtual card table.

It models physical card-table actions like creating tables, adding players, tracking dealer actor/position, creating zones, dealing, moving, shuffling, cutting, flipping, revealing, hiding, and reading safe event logs. It does not implement rules for specific games.

## Run

```sh
bun install
bun run dev
```

Open `http://localhost:3000` to see the acceptance test results page.

## Test

```sh
bun test
bun run typecheck
```

## Samples

The Big 2 browser demo lives in `examples/big2-demo`. Run the API and sample UI in separate terminals.

Terminal 1:

```sh
bun run sample:big2:api
```

Terminal 2:

```sh
bun run sample:big2
```

Then open `http://localhost:3001`.

## API

```text
POST /tables
GET  /tables/:tableId
POST /tables/:tableId/players
POST /tables/:tableId/dealer
POST /tables/:tableId/dealer/pass
POST /tables/:tableId/zones
POST /tables/:tableId/decks
POST /tables/:tableId/zones/:zoneId/shuffle
POST /tables/:tableId/zones/:zoneId/cut
POST /tables/:tableId/move
POST /tables/:tableId/deal
POST /tables/:tableId/flip
POST /tables/:tableId/reveal
POST /tables/:tableId/hide
GET  /tables/:tableId/events
```

Use `viewerPlayerId` on `GET /tables/:tableId` to project hidden cards for a specific player.
