import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { prisma } from "./prisma";
import { authRoutes } from "./routes/auth";
import { chainRoutes } from "./routes/chain";
import { householdRoutes } from "./routes/household";
import { planRoutes } from "./routes/plans";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const webOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000";

  await app.register(cors, { origin: webOrigin, credentials: true });
  await app.register(cookie);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? "Invalid request";
      return reply.code(400).send({ error: message });
    }
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error(error);
      return reply.code(500).send({ error: "Server error" });
    }
    return reply.code(statusCode).send({ error: error.message });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    const origin = request.headers.origin;
    if (origin && origin !== webOrigin) {
      return reply.code(403).send({ error: "Origin not allowed" });
    }
  });

  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  await authRoutes(app);
  await householdRoutes(app);
  await planRoutes(app);
  await chainRoutes(app);
  return app;
}
