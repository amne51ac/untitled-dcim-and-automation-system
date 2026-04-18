import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { JobRunStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { assertAuth } from "../../hooks/require-auth.js";
import { requireWrite } from "../../lib/auth-context.js";
import { newCorrelationId } from "../../lib/crypto.js";
import { recordAudit } from "../../services/audit.js";
import { toInputJson } from "../../lib/json.js";

const automationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/jobs", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.jobDefinition.findMany({
      where: { organizationId: organization.id },
      orderBy: { key: "asc" },
    });
    return { items };
  });

  app.post("/jobs", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        key: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        requiresApproval: z.boolean().optional(),
      })
      .parse(req.body);
    const created = await prisma.jobDefinition.create({
      data: {
        organizationId: ctx.organization.id,
        key: body.key,
        name: body.name,
        description: body.description,
        requiresApproval: body.requiresApproval ?? false,
      },
    });
    return { item: created };
  });

  app.post("/jobs/:key/run", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const key = (req.params as { key: string }).key;
    const body = z
      .object({
        input: z.record(z.unknown()).optional(),
        idempotencyKey: z.string().optional(),
      })
      .parse(req.body ?? {});
    const def = await prisma.jobDefinition.findFirst({
      where: { organizationId: ctx.organization.id, key, enabled: true },
    });
    if (!def) return reply.status(404).send({ error: "Job not found" });
    const correlationId = newCorrelationId();
    let status: JobRunStatus = JobRunStatus.PENDING;
    if (def.requiresApproval) status = JobRunStatus.APPROVAL_REQUIRED;

    if (body.idempotencyKey) {
      const existing = await prisma.jobRun.findFirst({
        where: { organizationId: ctx.organization.id, idempotencyKey: body.idempotencyKey },
      });
      if (existing) {
        return { item: existing, deduped: true };
      }
    }

    const run = await prisma.jobRun.create({
      data: {
        organizationId: ctx.organization.id,
        jobDefinitionId: def.id,
        status,
        input: body.input !== undefined ? toInputJson(body.input) : undefined,
        idempotencyKey: body.idempotencyKey,
        correlationId,
      },
    });

    if (!def.requiresApproval) {
      await prisma.jobRun.update({
        where: { id: run.id },
        data: {
          status: JobRunStatus.RUNNING,
          logs: "Simulated worker: job executed (placeholder).",
          output: toInputJson({
            ok: true,
            message: "No-op automation hook; connect workers in Phase 2.",
          }),
        },
      });
      const updated = await prisma.jobRun.findUniqueOrThrow({ where: { id: run.id } });
      await recordAudit({
        organizationId: ctx.organization.id,
        actor: `token:${ctx.token.id}`,
        action: "job_run",
        resourceType: "JobRun",
        resourceId: run.id,
        correlationId,
        after: updated,
      });
      return { item: updated, correlationId };
    }

    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "job_run_pending_approval",
      resourceType: "JobRun",
      resourceId: run.id,
      correlationId,
      after: run,
    });
    return { item: run, correlationId, message: "Approval required before execution." };
  });

  app.get("/job-runs", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.jobRun.findMany({
      where: { organizationId: organization.id },
      include: { jobDefinition: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items };
  });

  app.post("/change-requests", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
        payload: z.record(z.unknown()),
      })
      .parse(req.body);
    const correlationId = newCorrelationId();
    const cr = await prisma.changeRequest.create({
      data: {
        organizationId: ctx.organization.id,
        title: body.title,
        description: body.description,
        payload: toInputJson(body.payload),
        status: "DRAFT",
        correlationId,
      },
    });
    await recordAudit({
      organizationId: ctx.organization.id,
      actor: `token:${ctx.token.id}`,
      action: "create",
      resourceType: "ChangeRequest",
      resourceId: cr.id,
      correlationId,
      after: cr,
    });
    return { item: cr, correlationId };
  });

  app.get("/change-requests", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.changeRequest.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items };
  });

  app.get("/services", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { organization } = assertAuth(req);
    const items = await prisma.serviceInstance.findMany({
      where: { organizationId: organization.id, deletedAt: null },
      orderBy: { name: "asc" },
    });
    return { items };
  });

  app.post("/services", async (req, reply) => {
    if (!req.auth) return reply.status(401).send({ error: "Unauthorized" });
    const ctx = assertAuth(req);
    requireWrite(ctx);
    const body = z
      .object({
        name: z.string().min(1),
        serviceType: z.string().min(1),
        customerRef: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const created = await prisma.serviceInstance.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        serviceType: body.serviceType,
        customerRef: body.customerRef,
        metadata: body.metadata !== undefined ? toInputJson(body.metadata) : undefined,
      },
    });
    return { item: created };
  });
};

export default automationRoutes;
