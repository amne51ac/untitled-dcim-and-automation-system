import { prisma } from "../lib/prisma.js";
import { toInputJson } from "../lib/json.js";

export async function recordAudit(input: {
  organizationId: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actor: input.actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      correlationId: input.correlationId ?? undefined,
      before: input.before !== undefined ? toInputJson(input.before) : undefined,
      after: input.after !== undefined ? toInputJson(input.after) : undefined,
    },
  });
}
