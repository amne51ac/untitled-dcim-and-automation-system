import type { Prisma } from "@prisma/client";

/** Serialize arbitrary values for Prisma Json columns. */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
