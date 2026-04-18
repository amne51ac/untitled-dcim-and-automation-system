import { PrismaClient, ApiTokenRole, WebhookEvent } from "@prisma/client";
import { hashToken, generateRawToken } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    create: { name: "Demo Organization", slug: "demo" },
    update: {},
  });

  await prisma.project.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "default" },
    },
    create: { organizationId: org.id, name: "Default", slug: "default" },
    update: {},
  });

  const ltSite = await prisma.locationType.upsert({
    where: { name: "Site" },
    create: { name: "Site", description: "Campus or facility site" },
    update: {},
  });
  await prisma.locationType.upsert({
    where: { name: "Region" },
    create: { name: "Region", description: "Geographic region" },
    update: {},
  });

  const loc = await prisma.location.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "hq" },
    },
    create: {
      organizationId: org.id,
      locationTypeId: ltSite.id,
      name: "Headquarters",
      slug: "hq",
    },
    update: {},
  });

  const rack = await prisma.rack.upsert({
    where: {
      organizationId_locationId_name: {
        organizationId: org.id,
        locationId: loc.id,
        name: "RACK-01",
      },
    },
    create: {
      organizationId: org.id,
      locationId: loc.id,
      name: "RACK-01",
      uHeight: 42,
    },
    update: {},
  });

  const mfg = await prisma.manufacturer.upsert({
    where: { name: "Generic" },
    create: { name: "Generic" },
    update: {},
  });

  const dt = await prisma.deviceType.upsert({
    where: {
      manufacturerId_model: { manufacturerId: mfg.id, model: "Router-1U" },
    },
    create: { manufacturerId: mfg.id, model: "Router-1U", uHeight: 1 },
    update: {},
  });

  const role = await prisma.deviceRole.upsert({
    where: { name: "router" },
    create: { name: "router" },
    update: {},
  });

  await prisma.device.upsert({
    where: {
      organizationId_name: { organizationId: org.id, name: "core-01" },
    },
    create: {
      organizationId: org.id,
      rackId: rack.id,
      deviceTypeId: dt.id,
      deviceRoleId: role.id,
      name: "core-01",
      status: "ACTIVE",
      positionU: 20,
      face: "front",
    },
    update: {},
  });

  const vrf = await prisma.vrf.upsert({
    where: {
      organizationId_name: { organizationId: org.id, name: "default" },
    },
    create: { organizationId: org.id, name: "default" },
    update: {},
  });

  await prisma.prefix.upsert({
    where: {
      organizationId_vrfId_cidr: {
        organizationId: org.id,
        vrfId: vrf.id,
        cidr: "10.0.0.0/16",
      },
    },
    create: {
      organizationId: org.id,
      vrfId: vrf.id,
      cidr: "10.0.0.0/16",
      description: "Seed prefix",
    },
    update: {},
  });

  await prisma.jobDefinition.upsert({
    where: {
      organizationId_key: { organizationId: org.id, key: "noop" },
    },
    create: {
      organizationId: org.id,
      key: "noop",
      name: "No-op job",
      description: "Placeholder until worker pool is wired",
      requiresApproval: false,
    },
    update: {},
  });

  await prisma.pluginRegistration.upsert({
    where: { packageName: "nims.builtin.reporting" },
    create: {
      packageName: "nims.builtin.reporting",
      version: "0.1.0",
      enabled: true,
      manifest: { panels: ["inventory-summary"] },
    },
    update: {},
  });

  const adminRaw = generateRawToken();
  const writeRaw = generateRawToken();

  await prisma.apiToken.deleteMany({ where: { organizationId: org.id, name: { in: ["seed-admin", "seed-write"] } } });
  await prisma.apiToken.createMany({
    data: [
      {
        organizationId: org.id,
        name: "seed-admin",
        tokenHash: hashToken(adminRaw),
        role: ApiTokenRole.ADMIN,
      },
      {
        organizationId: org.id,
        name: "seed-write",
        tokenHash: hashToken(writeRaw),
        role: ApiTokenRole.WRITE,
      },
    ],
  });

  await prisma.webhookSubscription.deleteMany({
    where: { organizationId: org.id, name: "seed-example" },
  });
  await prisma.webhookSubscription.create({
    data: {
      organizationId: org.id,
      name: "seed-example",
      url: "https://example.com/webhooks/nims",
      resourceTypes: [],
      events: [WebhookEvent.CREATE, WebhookEvent.UPDATE],
    },
  });

  console.log("\n=== Seed complete ===");
  console.log(`Organization: ${org.slug} (${org.id})`);
  console.log("\nAPI tokens (use Authorization: Bearer <token>):");
  console.log(`  ADMIN:  ${adminRaw}`);
  console.log(`  WRITE:  ${writeRaw}`);
  console.log("\nExample: curl -H \"Authorization: Bearer ${ADMIN}\" http://localhost:8080/v1/me\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
