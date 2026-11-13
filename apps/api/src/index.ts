import { buildApp } from "./app";

const app = await buildApp();
const port = Number(process.env.API_PORT ?? 4000);

try {
  await app.listen({ port, host: "127.0.0.1" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
