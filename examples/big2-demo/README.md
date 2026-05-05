# Big 2 Demo

This browser sample is independent of the Open Card API server. It serves a small UI on its own port, then uses `fetch` to drive Open Card table, player, zone, deck, deal, move, flip, and event endpoints.

## Run

Terminal 1:

```sh
bun run sample:big2:api
```

Terminal 2:

```sh
bun run sample:big2
```

Open `http://localhost:3001`.

Set `BIG2_DEMO_PORT` to serve the sample UI on another port. The UI defaults to `http://localhost:3000` for the Open Card API, and the API field can be changed at runtime.

## Big 2 rules in this sample

- Four players receive 13 cards.
- The player holding `3D` opens, and the opening play must include `3D`.
- Legal plays are singles, pairs, triples, straights, flushes, full houses, four-of-a-kind hands, and straight flushes.
- Card rank order is `3 4 5 6 7 8 9 10 J Q K A 2`.
- Suit order is diamonds, clubs, hearts, spades.
- Five-card hand order is straight, flush, full house, four of a kind, straight flush.
- Three consecutive passes clear the active play, and the last player who played leads the next trick.
- The first player to empty their hand wins.

The rules live in `examples/big2-demo/src/big2.ts`; Open Card still models only physical table operations.
