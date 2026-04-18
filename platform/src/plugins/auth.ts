import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/crypto.js";
import type { AuthContext } from "../lib/auth-context.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

async function resolveAuth(req: FastifyRequest): Promise<AuthContext | undefined> {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return undefined;
  const raw = h.slice(7).trim();
  if (!raw) return undefined;
  const tokenHash = hashToken(raw);
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: { organization: true },
  });
  if (!token) return undefined;
  if (token.expiresAt && token.expiresAt < new Date()) return undefined;
  void prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });
  return {
    organization: token.organization,
    token,
    role: token.role,
  };
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (req) => {
    req.auth = await resolveAuth(req);
  });
};

export default fp(authPlugin, { name: "auth-context" });
