import type { ApiToken, ApiTokenRole, Organization } from "@prisma/client";

export type AuthContext = {
  organization: Organization;
  token: ApiToken;
  role: ApiTokenRole;
};

export function requireWrite(ctx: AuthContext | undefined): asserts ctx is AuthContext {
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "READ") {
    const e = new Error("Forbidden: read-only token");
    (e as Error & { statusCode?: number }).statusCode = 403;
    throw e;
  }
}

export function requireAdmin(ctx: AuthContext | undefined): asserts ctx is AuthContext {
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "ADMIN") {
    const e = new Error("Forbidden: admin required");
    (e as Error & { statusCode?: number }).statusCode = 403;
    throw e;
  }
}
