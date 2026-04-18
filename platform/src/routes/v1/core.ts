import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { assertAuth } from "../../hooks/require-auth.js";
import { requireWrite, requireAdmin } from "../../lib/auth-context.js";
import { hashToken, generateRawToken } from "../../lib/crypto.js";
import { WebhookEvent } from "@prisma/client";

const webhookBody = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  resourceTypes: z.array(z.string()).default([]),
  events: z.array(z.enum(["CREATE", "UPDATE", "DELETE"])).min(1),
});

const coreRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization, token, role } = req.auth;
    return {
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      token: { id: token.id, name: token.name, role },
    };
  });

  app.post("/tokens", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireAdmin(ctx);
    const body = z
      .object({
        name: z.string().min(1),
        role: z.enum(["READ", "WRITE", "ADMIN"]).default("WRITE"),
      })
      .parse(req.body);
    const raw = generateRawToken();
    const tokenHash = hashToken(raw);
    const created = await prisma.apiToken.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        tokenHash,
        role: body.role,
      },
    });
    return {
      id: created.id,
      name: created.name,
      role: created.role,
      token: raw,
      message: "Store this token securely; it will not be shown again.",
    };
  });

  app.post("/webhooks", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = webhookBody.parse(req.body);
    const created = await prisma.webhookSubscription.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        url: body.url,
        secret: body.secret,
        resourceTypes: body.resourceTypes,
        events: body.events as WebhookEvent[],
      },
    });
    return { id: created.id, name: created.name, url: created.url };
  });

  app.get("/audit-events", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    const take = Math.min(100, Number((req.query as { limit?: string }).limit) || 50);
    const rows = await prisma.auditEvent.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { createdAt: "desc" },
      take,
    });
    return { items: rows };
  });

  app.get("/plugins", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    assertAuth(req);
    const items = await prisma.pluginRegistration.findMany({ orderBy: { packageName: "asc" } });
    return { items };
  });
};

export default coreRoutes;
