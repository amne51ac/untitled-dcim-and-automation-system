import "dotenv/config";
import { buildApp } from "./app.js";

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 8080);

const app = await buildApp();

try {
  await app.listen({ host, port });
  app.log.info(`Listening on http://${host}:${port}`);
  app.log.info(`OpenAPI UI: http://${host}:${port}/docs`);
  app.log.info(`GraphiQL: http://${host}:${port}/graphql`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
