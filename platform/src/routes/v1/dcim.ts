import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { assertAuth } from "../../hooks/require-auth.js";
import { requireWrite } from "../../lib/auth-context.js";
import { newCorrelationId } from "../../lib/crypto.js";
import { recordAudit } from "../../services/audit.js";
import { dispatchWebhooks } from "../../services/webhooks.js";

const dcimRoutes: FastifyPluginAsync = async (app) => {
  const orgWhere = (id: string) => ({ organizationId: id, deletedAt: null });

  app.get("/locations", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.location.findMany({
      where: orgWhere(organization.id),
      include: { locationType: true, parent: true },
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/locations", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        locationTypeId: z.string().uuid(),
        parentId: z.string().uuid().optional(),
        description: z.string().optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.location.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        slug: body.slug,
        locationTypeId: body.locationTypeId,
        parentId: body.parentId,
        description: body.description,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Location",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Location",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.get("/racks", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.rack.findMany({
      where: orgWhere(organization.id),
      include: { location: true },
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/racks", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        name: z.string().min(1),
        locationId: z.string().uuid(),
        uHeight: z.number().int().positive().optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.rack.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        locationId: body.locationId,
        uHeight: body.uHeight ?? 42,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Rack",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Rack",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.get("/devices", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.device.findMany({
      where: orgWhere(organization.id),
      include: { deviceType: { include: { manufacturer: true } }, deviceRole: true, rack: true },
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/devices", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        name: z.string().min(1),
        deviceTypeId: z.string().uuid(),
        deviceRoleId: z.string().uuid(),
        rackId: z.string().uuid().optional(),
        serialNumber: z.string().optional(),
        positionU: z.number().int().optional(),
        face: z.string().optional(),
        status: z.enum(["PLANNED", "STAGED", "ACTIVE", "DECOMMISSIONED"]).optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.device.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        deviceTypeId: body.deviceTypeId,
        deviceRoleId: body.deviceRoleId,
        rackId: body.rackId,
        serialNumber: body.serialNumber,
        positionU: body.positionU,
        face: body.face,
        status: body.status,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Device",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Device",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.get("/devices/:id", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const id = (req.params as { id: string }).id;
    const device = await prisma.device.findFirst({
      where: { id, organizationId: organization.id, deletedAt: null },
      include: {
        deviceType: { include: { manufacturer: true } },
        deviceRole: true,
        rack: true,
        interfaces: { where: { deletedAt: null } },
        observed: true,
      },
    });
    if (!device) return reply.status(404).send({ error: "Not found" });
    return { item: device };
  });

  app.post("/devices/:id/interfaces", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const deviceId = (req.params as { id: string }).id;
    const body = z
      .object({
        name: z.string().min(1),
        type: z.string().default("ethernet"),
        macAddress: z.string().optional(),
        mtu: z.number().int().optional(),
      })
      .parse(req.body);
    const dev = await prisma.device.findFirst({
      where: { id: deviceId, organizationId: ctx.organization.id, deletedAt: null },
    });
    if (!dev) return reply.status(404).send({ error: "Device not found" });
    const correlationId = newCorrelationId();
    const created = await prisma.interface.create({
      data: {
        deviceId,
        name: body.name,
        type: body.type,
        macAddress: body.macAddress,
        mtu: body.mtu,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Interface",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Interface",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });

  app.post("/cables", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        interfaceAId: z.string().uuid(),
        interfaceBId: z.string().uuid(),
        label: z.string().optional(),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const created = await prisma.cable.create({
      data: {
        interfaceAId: body.interfaceAId,
        interfaceBId: body.interfaceBId,
        label: body.label,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "Cable",
      resourceId: created.id,
      correlationId,
      after: created,
    });
    dispatchWebhooks({
      organizationId: ctx.organization.id,
      resourceType: "Cable",
      resourceId: created.id,
      event: "create",
    });
    return { item: created, correlationId };
  });
};

export default dcimRoutes;
