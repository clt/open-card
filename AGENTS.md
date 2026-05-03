# AGENTS.md

Repository conventions for Open Card.

## Runtime and tooling

Use Bun as the runtime, package manager, test runner, and development toolchain.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`.
- Use `bun install` instead of `npm install`, `yarn install`, or `pnpm install`.
- Use `bun run <script>` instead of `npm run <script>`, `yarn run <script>`, or `pnpm run <script>`.
- Use `bunx <package> <command>` instead of `npx <package> <command>`.
- Use `bun test` for tests.
- Bun automatically loads `.env`; do not add `dotenv`.

Common commands:

```sh
bun install
bun run dev
bun run start
bun test
bun run typecheck
```

## Git workflow

- Always work from a feature branch based off `main`.
- Do not make implementation changes directly on `main`.
- Use the `codex/` branch prefix unless the user asks for a different branch name.

## HTTP and dependencies

- Use `Bun.serve()` for HTTP.
- Do not add Express, Fastify, Nest, Hono, Vite, or other server/framework tooling.
- Prefer Web-standard APIs: `Request`, `Response`, `URL`, and `Headers`.
- Use Zod for request validation.
- Keep route handlers thin: parse input, validate input, call domain/store code, return JSON.
- Prefer `Bun.file` for simple file reads/writes.
- Prefer `Bun.$` over shell helper libraries like `execa`.

## Project structure

Keep domain logic separate from HTTP.

```text
src/
  index.ts
  domain/
  store/
  http/
test/
```

- `src/domain/` owns card, table, zone, visibility, event, and operation logic.
- `src/store/` owns storage interfaces and implementations.
- `src/http/` owns routing, schemas, responses, and simple HTML pages.
- Keep storage behind an interface. The current implementation is in-memory.

## Domain conventions

Open Card models physical card-table mechanics, not game rules.

- Model tables, players, zones, cards, order, movement, shuffling, cutting, dealing, flipping, visibility, and events.
- Do not implement scoring, turn legality, hand rankings, win conditions, or rules for specific games.
- A deck is just a zone containing ordered card IDs.
- Card `id` is the unique physical instance ID; card `code` is the face value such as `AS` or `10H`.
- Mutating operations should be atomic: validate first, then mutate.
- Moves must not duplicate or lose cards.
- Moving explicit card IDs should preserve requested order.
- Count-based moves must support top and bottom selection.
- Destination `top` inserts the selected group before existing cards while preserving group order.

## Visibility and events

- Project table state for a viewer with `viewerPlayerId`.
- Authorized viewers may see full card identity.
- Unauthorized viewers must receive hidden-card placeholders.
- Face-up cards are visible to everyone.
- Mutating operations should append event log entries.
- Public event summaries must not leak hidden card identities.
- Internal event metadata may include card IDs for debugging and tests, but HTTP event responses should expose safe summaries only.

## Tests

- Put focused unit/domain tests under `test/`.
- Add HTTP tests for route behavior and status codes.
- Add acceptance tests for real table setups, but assert only generic physical mechanics and visibility.
- Use `bun test` and `bun run typecheck` before handing off code changes.
