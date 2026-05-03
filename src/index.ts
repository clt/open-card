import { handleRequest } from "./http/router";

export function startServer(port = Number(Bun.env.PORT ?? 3000)) {
  const server = Bun.serve({
    port,
    fetch: handleRequest,
  });

  console.log(`open-card API listening on http://localhost:${server.port}`);
  return server;
}

if (import.meta.main) {
  startServer();
}
