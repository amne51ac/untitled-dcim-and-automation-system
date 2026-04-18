import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { assertAuth } from "../../hooks/require-auth.js";
import { requireWrite } from "../../lib/auth-context.js";
import { newCorrelationId } from "../../lib/crypto.js";
import { recordAudit } from "../../services/audit.js";
import { dispatchWebhooks } from "../../services/webhooks.js";

const circuitsRoutes: FastifyPluginAsync = async (app) => {
  const orgWhere = (id: string) => ({ organizationId: id, deletedAt: null });

  app.get("/providers", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.provider.findMany({
      where: orgWhere(organization.id),
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/providers", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z.object({ name: z.string().min(1), asn: z.number().int().optional() }).parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.provider.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        asn: body.asn,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Provider",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Provider",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.get("/circuits", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.circuit.findMany({
      where: orgWhere(organization.id),
      include: { provider: true },
      orderBy: { cid: "asc" },
    });
    return { items };
  });

  app.post("/circuits", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        providerId: z.string().uuid(),
        cid: z.string().min(1),
        bandwidthMbps: z.number().int().positive().optional(),
        status: z.enum(["PLANNED", "ACTIVE", "DECOMMISSIONED"]).optional(),
        aSideNotes: z.string().optional(),
        zSideNotes: z.string().optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.circuit.create({
      data: {
        organizationId: ctx.organization.id,
        providerId: body.providerId,
        cid: body.cid,
        bandwidthMbps: body.bandwidthMbps,
        status: body.status,
        aSideNotes: body.aSideNotes,
        zSideNotes: body.zSideNotes,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Circuit",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Circuit",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });
};

export default circuitsRoutes;
