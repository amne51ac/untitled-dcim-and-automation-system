import { createHash, randomBytes } from "node:crypto";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newCorrelationId(): string {
  return randomBytes(16).toString("hex");
}
