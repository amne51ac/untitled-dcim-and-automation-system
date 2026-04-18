import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ObservationKind } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { assertAuth } from "../../hooks/require-auth.js";
import { requireWrite } from "../../lib/auth-context.js";
import { newCorrelationId } from "../../lib/crypto.js";
import { recordAudit } from "../../services/audit.js";
import { toInputJson } from "../../lib/json.js";

/**
 * AS1-style closed-loop: ingest observed telemetry, flag drift vs intent (minimal Phase 1).
 */
const reconciliationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/observed-state", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        kind: z.enum(["DEVICE", "INTERFACE", "SERVICE"]),
        deviceId: z.string().uuid().optional(),
        lastSeenAt: z.string().datetime().optional(),
        health: z.string().optional(),
        payload: z.record(z.unknown()).optional(),
        driftDetected: z.boolean().optional(),
        driftSummary: z.string().optional(),
      })
      .parse(req.body);

    if (body.kind === "DEVICE" && !body.deviceId) {
      return reply.status(400).send({ error: "deviceId required for DEVICE observations" });
    }

    const correlationId = newCorrelationId();
    const kind = body.kind as keyof typeof ObservationKind;
    const observationKind = ObservationKind[kind];

    let drift = body.driftDetected ?? false;
    let summary = body.driftSummary;

    if (body.deviceId && body.kind === "DEVICE") {
      const device = await prisma.device.findFirst({
        where: { id: body.deviceId, organizationId: ctx.organization.id, deletedAt: null },
      });
      if (!device) return reply.status(404).send({ error: "Device not found" });
      if (device.status !== "ACTIVE" && device.status !== "STAGED") {
        drift = true;
        summary = summary ?? `Intent status is ${device.status}; observed activity suggests mismatch.`;
      }
    }

    let upserted;
    if (body.deviceId) {
      const existing = await prisma.observedResourceState.findFirst({
        where: { organizationId: ctx.organization.id, deviceId: body.deviceId },
      });
      if (existing) {
        upserted = await prisma.observedResourceState.update({
          where: { id: existing.id },
          data: {
            kind: observationKind,
            lastSeenAt: body.lastSeenAt ? new Date(body.lastSeenAt) : new Date(),
            health: body.health,
            payload: body.payload !== undefined ? toInputJson(body.payload) : undefined,
            driftDetected: drift,
            driftSummary: summary,
          },
        });
      } else {
        upserted = await prisma.observedResourceState.create({
          data: {
            organizationId: ctx.organization.id,
            kind: observationKind,
            deviceId: body.deviceId,
            lastSeenAt: body.lastSeenAt ? new Date(body.lastSeenAt) : new Date(),
            health: body.health,
            payload: body.payload !== undefined ? toInputJson(body.payload) : undefined,
            driftDetected: drift,
            driftSummary: summary,
          },
        });
      }
    } else {
      upserted = await prisma.observedResourceState.create({
        data: {
          organizationId: ctx.organization.id,
          kind: observationKind,
          lastSeenAt: body.lastSeenAt ? new Date(body.lastSeenAt) : new Date(),
          health: body.health,
          payload: body.payload !== undefined ? toInputJson(body.payload) : undefined,
          driftDetected: drift,
          driftSummary: summary,
        },
      });
    }

    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "observed_state_upsert",
      resourceType: "ObservedResourceState",
      resourceId: upserted.id,
      correlationId,
      after: upserted,
    });

    return { item: upserted, correlationId };
  });

  app.get("/observed-state", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.observedResourceState.findMany({
      where: { organizationId: organization.id },
      include: { device: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return { items };
  });
};

export default reconciliationRoutes;
