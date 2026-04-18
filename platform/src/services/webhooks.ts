import { createHmac } from "node:crypto";
import { WebhookEvent } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type WebhookPayload = {
  event: "create" | "update" | "delete";
  resourceType: string;
  resourceId: string;
  organizationId: string;
  at: string;
  diff?: { before?: unknown; after?: unknown };
};

function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const eventToEnum: Record<WebhookPayload["event"], WebhookEvent> = {
  create: WebhookEvent.CREATE,
  update: WebhookEvent.UPDATE,
  delete: WebhookEvent.DELETE,
};

export function dispatchWebhooks(input: {
  organizationId: string;
  resourceType: string;
  resourceId: string;
  event: WebhookPayload["event"];
  diff?: WebhookPayload["diff"];
}): void {
  const payload: WebhookPayload = {
    event: input.event,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    organizationId: input.organizationId,
    at: new Date().toISOString(),
    diff: input.diff,
  };
  const body = JSON.stringify(payload);

  void (async () => {
    const subs = await prisma.webhookSubscription.findMany({
      where: {
        organizationId: input.organizationId,
        enabled: true,
        events: { has: eventToEnum[input.event] },
      },
    });
    for (const sub of subs) {
      if (sub.resourceTypes.length && !sub.resourceTypes.includes(input.resourceType)) continue;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-NIMS-Event": input.event,
        "X-NIMS-Resource": input.resourceType,
      };
      if (sub.secret) {
        headers["X-NIMS-Signature"] = `sha256=${signBody(sub.secret, body)}`;
      }
      try {
        const res = await fetch(sub.url, { method: "POST", headers, body });
        if (!res.ok) {
          reqLog(sub.id, `webhook failed ${res.status}`);
        }
      } catch (e) {
        reqLog(sub.id, `webhook error ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  })();
}

function reqLog(subId: string, msg: string): void {
  console.warn(`[webhook ${subId}] ${msg}`);
}
