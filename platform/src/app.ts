import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./routes/health.js";
import coreRoutes from "./routes/v1/core.js";
import dcimRoutes from "./routes/v1/dcim.js";
import ipamRoutes from "./routes/v1/ipam.js";
import circuitsRoutes from "./routes/v1/circuits.js";
import automationRoutes from "./routes/v1/automation.js";
import reconciliationRoutes from "./routes/v1/reconciliation.js";
import { registerGraphql } from "./graphql/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  await app.register(cors, { origin: true });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "NIMS Platform API",
        description:
          "DCIM, IPAM, circuits, automation, and closed-loop inventory (clean-room derived). Read-only GraphQL at /graphql.",
        version: "0.1.0",
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(coreRoutes, { prefix: "/v1" });
  await app.register(dcimRoutes, { prefix: "/v1" });
  await app.register(ipamRoutes, { prefix: "/v1" });
  await app.register(circuitsRoutes, { prefix: "/v1" });
  await app.register(automationRoutes, { prefix: "/v1" });
  await app.register(reconciliationRoutes, { prefix: "/v1" });

  await registerGraphql(app);

  return app;
}
