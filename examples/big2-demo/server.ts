const port = readPort(Bun.env.BIG2_DEMO_PORT ?? "3001");

const staticFiles: Record<string, { file: Bun.BunFile; contentType: string }> = {
  "/": {
    file: Bun.file(new URL("./public/index.html", import.meta.url)),
    contentType: "text/html; charset=utf-8",
  },
  "/styles.css": {
    file: Bun.file(new URL("./public/styles.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  },
};

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/app.js") {
      return bundleApp();
    }

    const staticFile = staticFiles[url.pathname];

    if (staticFile !== undefined) {
      return new Response(staticFile.file, {
        headers: {
          "content-type": staticFile.contentType,
          "cache-control": "no-store",
        },
      });
    }

    return new Response("Not found.", { status: 404 });
  },
});

console.log(`Big 2 demo running at http://localhost:${server.port}`);
console.log("Start the Open Card API separately with: bun run sample:big2:api");

async function bundleApp(): Promise<Response> {
  const result = await Bun.build({
    entrypoints: [new URL("./src/app.ts", import.meta.url).pathname],
    target: "browser",
    format: "esm",
    sourcemap: "inline",
    minify: false,
  });

  if (!result.success) {
    return new Response(result.logs.map((log) => log.message).join("\n"), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const output = result.outputs[0];

  if (output === undefined) {
    return new Response("Bun build produced no output.", { status: 500 });
  }

  return new Response(await output.text(), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function readPort(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid BIG2_DEMO_PORT: ${value}`);
  }

  return parsed;
}
