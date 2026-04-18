import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { assertAuth } from "../../hooks/require-auth.js";
import { requireWrite } from "../../lib/auth-context.js";
import { newCorrelationId } from "../../lib/crypto.js";
import { recordAudit } from "../../services/audit.js";
import { dispatchWebhooks } from "../../services/webhooks.js";

const ipamRoutes: FastifyPluginAsync = async (app) => {
  const orgWhere = (id: string) => ({ organizationId: id, deletedAt: null });

  app.get("/vrfs", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.vrf.findMany({
      where: orgWhere(organization.id),
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/vrfs", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z.object({ name: z.string().min(1), rd: z.string().optional() }).parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.vrf.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        rd: body.rd,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Vrf",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Vrf",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.get("/prefixes", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.prefix.findMany({
      where: orgWhere(organization.id),
      include: { vrf: true },
      orderBy: { cidr: "asc" },
    });
    return { items };
  });

  app.post("/prefixes", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        vrfId: z.string().uuid(),
        cidr: z.string().min(1),
        description: z.string().optional(),
        parentId: z.string().uuid().optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.prefix.create({
      data: {
        organizationId: ctx.organization.id,
        vrfId: body.vrfId,
        cidr: body.cidr,
        description: body.description,
        parentId: body.parentId,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Prefix",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Prefix",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.get("/ip-addresses", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.ipAddress.findMany({
      where: orgWhere(organization.id),
      include: { prefix: true, interface: { include: { device: true } } },
      take: 500,
      orderBy: { address: "asc" },
    });
    return { items };
  });

  app.post("/ip-addresses", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        prefixId: z.string().uuid(),
        address: z.string().min(1),
        description: z.string().optional(),
        interfaceId: z.string().uuid().optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.ipAddress.create({
      data: {
        organizationId: ctx.organization.id,
        prefixId: body.prefixId,
        address: body.address,
        description: body.description,
        interfaceId: body.interfaceId,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "IpAddress",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "IpAddress",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.get("/vlans", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.vlan.findMany({
      where: orgWhere(organization.id),
      include: { vlanGroup: true },
      orderBy: { vid: "asc" },
    });
    return { items };
  });

  app.post("/vlans", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        vid: z.number().int().min(1).max(4094),
        name: z.string().min(1),
        vlanGroupId: z.string().uuid().optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.vlan.create({
      data: {
        organizationId: ctx.organization.id,
        vid: body.vid,
        name: body.name,
        vlanGroupId: body.vlanGroupId,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Vlan",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Vlan",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });
};

export default ipamRoutes;
