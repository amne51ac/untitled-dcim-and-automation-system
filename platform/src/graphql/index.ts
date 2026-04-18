import type { FastifyInstance, FastifyRequest } from "fastify";
import mercurius from "mercurius";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/crypto.js";

const schema = `
  type Organization {
    id: ID!
    name: String!
    slug: String!
  }

  type Location {
    id: ID!
    name: String!
    slug: String!
    parentId: ID
  }

  type Rack {
    id: ID!
    name: String!
    uHeight: Int!
    locationId: ID!
  }

  type Device {
    id: ID!
    name: String!
    status: String!
    rackId: ID
  }

  type Prefix {
    id: ID!
    cidr: String!
    vrfId: ID!
  }

  type IpAddress {
    id: ID!
    address: String!
    prefixId: ID!
  }

  type Query {
    organization: Organization
    locations: [Location!]!
    racks: [Rack!]!
    devices: [Device!]!
    prefixes: [Prefix!]!
    ipAddresses: [IpAddress!]!
  }
`;

export async function registerGraphql(app: FastifyInstance): Promise<void> {
  // Mercurius is a fastify-plugin; default export typings conflict with Fastify 5 strict generics.
  await app.register(mercurius as Parameters<FastifyInstance["register"]>[0], {
    schema,
    graphiql: true,
    context: async (req: FastifyRequest) => {
      const h = req.headers.authorization;
      if (!h?.startsWith("Bearer ")) return { orgId: null as string | null };
      const raw = h.slice(7).trim();
      const token = await prisma.apiToken.findUnique({
        where: { tokenHash: hashToken(raw) },
      });
      return { orgId: token?.organizationId ?? null };
    },
    resolvers: {
      Query: {
        organization: async (_: unknown, __: unknown, ctx: { orgId: string | null }) => {
          if (!ctx.orgId) return null;
          return prisma.organization.findUnique({ where: { id: ctx.orgId } });
        },
        locations: async (_: unknown, __: unknown, ctx: { orgId: string | null }) => {
          if (!ctx.orgId) return [];
          return prisma.location.findMany({
            where: { organizationId: ctx.orgId, deletedAt: null },
            orderBy: { name: "asc" },
          });
        },
        racks: async (_: unknown, __: unknown, ctx: { orgId: string | null }) => {
          if (!ctx.orgId) return [];
          return prisma.rack.findMany({
            where: { organizationId: ctx.orgId, deletedAt: null },
            orderBy: { name: "asc" },
          });
        },
        devices: async (_: unknown, __: unknown, ctx: { orgId: string | null }) => {
          if (!ctx.orgId) return [];
          return prisma.device.findMany({
            where: { organizationId: ctx.orgId, deletedAt: null },
            orderBy: { name: "asc" },
          });
        },
        prefixes: async (_: unknown, __: unknown, ctx: { orgId: string | null }) => {
          if (!ctx.orgId) return [];
          return prisma.prefix.findMany({
            where: { organizationId: ctx.orgId, deletedAt: null },
            orderBy: { cidr: "asc" },
          });
        },
        ipAddresses: async (_: unknown, __: unknown, ctx: { orgId: string | null }) => {
          if (!ctx.orgId) return [];
          return prisma.ipAddress.findMany({
            where: { organizationId: ctx.orgId, deletedAt: null },
            take: 500,
            orderBy: { address: "asc" },
          });
        },
      },
    },
  });
}
