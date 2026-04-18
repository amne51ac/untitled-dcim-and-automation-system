import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!req.auth) {
    await reply.status(401).send({ error: "Unauthorized", message: "Valid Bearer token required" });
  }
}

export function assertAuth(req: FastifyRequest): NonNullable<FastifyRequest["auth"]> {
  if (!req.auth) {
    const e = new Error("Unauthorized");
    (e as Error & { statusCode?: number }).statusCode = 401;
    throw e;
  }
  return req.auth;
}
