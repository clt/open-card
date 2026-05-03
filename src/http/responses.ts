import { z } from "zod";
import { DomainError } from "../domain/errors";

export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "text/html; charset=utf-8",
    },
  });
}

export function handleError(error: unknown): Response {
  if (error instanceof DomainError) {
    return json({ error: error.message }, error.status);
  }

  if (error instanceof z.ZodError) {
    return json({ error: "Validation failed.", details: error.issues }, 400);
  }

  console.error(error);
  return json({ error: "Internal server error." }, 500);
}

export function notFoundResponse(): Response {
  return json({ error: "Not found." }, 404);
}
