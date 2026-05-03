# Dealer Actor And Dealer Position

## Summary

- Add table-level dealer state with two separate concepts:
  physical `actor` and rotating `positionPlayerId`.
- A dealer actor may be `{ type: "player", playerId }` or
  `{ type: "nonPlayer", name }`.
- Passing the deal advances only `positionPlayerId`; it does not
  change the physical actor.
- Existing card dealing remains generic: `/deal` still uses caller-
  provided `toZoneIds` and does not enforce dealer permissions.

## Key Changes

- Add `dealer` to `Table` and projected table responses:

  ```ts
  {
    actor: { type: "player"; playerId: string } |
      { type: "nonPlayer"; name: string } |
      null;
    positionPlayerId: string | null;
  }
  ```

- Initialize new tables with `{ actor: null, positionPlayerId: null }`.
- Add domain operations:
  - `setDealer`: validates referenced players, updates actor and/or
    position, supports `null` to clear either field, appends
    `dealer.updated`.
  - `passDealerPosition`: uses player join order, supports
    `direction: "next" | "previous"` defaulting to `"next"`,
    requires an existing valid `positionPlayerId`, appends
    `dealer.passed`.
- Add HTTP endpoints:
  - `POST /tables/:tableId/dealer`

    ```json
    {
      "actor": { "type": "player", "playerId": "player_1" },
      "positionPlayerId": "player_1",
      "actorPlayerId": "player_2"
    }
    ```

    Omitted `actor` or `positionPlayerId` leaves that field unchanged;
    `null` clears it.
  - `POST /tables/:tableId/dealer/pass`

    ```json
    {
      "direction": "next",
      "actorPlayerId": "player_1"
    }
    ```

- Return `{ dealer, table }` from both new endpoints, with `table`
  projected for `actorPlayerId` when provided.
- Keep `/tables/:tableId/deal` unchanged except that normal table
  responses now include `dealer`.

## Test Plan

- Domain tests:
  - setting a player dealer actor and dealer position succeeds.
  - setting a non-player dealer actor succeeds.
  - setting actor or position to an unknown player throws.
  - clearing actor or position with `null` works.
  - passing advances position by join order and wraps around.
  - passing previous wraps backward.
  - passing with no current position fails without mutation.
  - passing does not change non-player or player actor.
- HTTP tests:
  - `POST /dealer` validates payloads and projects dealer state.
  - `POST /dealer/pass` returns updated dealer state and appends safe
    public events.
  - existing `/deal` still works with no dealer configured.
- Regression tests:
  - projected table card visibility remains unchanged.
  - public events still omit metadata and card identities.

## Assumptions

- Player join order is the default dealer-position rotation order.
- Dealer state is table metadata, not rule enforcement.
- "Passing the deal" means passing the position/button only.
- Explicit seating/order APIs can be added later without changing this
  dealer API shape.

## Acceptance Scenarios

1. Non-player dealer with passable player position

   - Create a table with players Alice, Bob, and Carol in that order.
   - Set dealer actor to `{ type: "nonPlayer", name: "House" }` and
     `positionPlayerId` to Alice.
   - Fetch the table and assert the dealer actor is House and the dealer
     position is Alice.
   - Call `POST /tables/:tableId/dealer/pass`.
   - Assert the dealer actor remains House and the dealer position
     advances to Bob.
   - Pass twice more and assert the position advances to Carol, then
     wraps to Alice.

2. Player dealer actor is independent from dealer position

   - Create a table with Alice and Bob.
   - Set dealer actor to Alice and `positionPlayerId` to Alice.
   - Call `POST /tables/:tableId/dealer/pass`.
   - Assert the dealer actor remains Alice and the dealer position
     advances to Bob.

3. Existing deal operation remains generic

   - Create a table with players, a draw zone, and player hand zones.
   - Set a non-player dealer actor and a player dealer position.
   - Add a deck.
   - Call existing `POST /tables/:tableId/deal` with explicit
     `toZoneIds`.
   - Assert cards are dealt round-robin as before and dealer state is
     unchanged.

4. Public events are safe and useful

   - After setting and passing dealer state, call
     `GET /tables/:tableId/events`.
   - Assert events include `dealer.updated` and `dealer.passed`.
   - Assert public event objects omit metadata and do not expose card
     identities.

## Failure Scenarios

- Setting dealer actor to a missing player returns `404`.
- Setting `positionPlayerId` to a missing player returns `404`.
- Passing dealer position before one is configured returns an error and
  does not mutate table state.
- Passing when the current `positionPlayerId` no longer resolves to a
  player returns an error and does not mutate table state.

## Verification

- Confirm `docs/dealer_acceptance_tests.md` exists.
- Confirm the file is plain Markdown and contains the four acceptance
  scenarios, failure scenarios, and assumptions.
