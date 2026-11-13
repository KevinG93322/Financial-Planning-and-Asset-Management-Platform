import type { FastifyInstance } from "fastify";
import { httpError } from "../http";
import { prisma } from "../prisma";
import { generatePlanForUser, serializePlan } from "../planning/generate";
import { requireUser } from "./auth";

export async function planRoutes(app: FastifyInstance) {
  app.get("/plans", async (request) => {
    const user = await requireUser(request);
    const snapshots = await prisma.snapshot.findMany({
      where: { userId: user.id },
      include: { plan: true, chainRecord: true },
      orderBy: { createdAt: "desc" },
    });
    return { plans: snapshots.map((snapshot) => serializePlan(snapshot)).filter((plan) => plan !== null) };
  });

  app.get("/plans/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const snapshot = await prisma.snapshot.findFirst({
      where: { userId: user.id, plan: { id } },
      include: { plan: true, chainRecord: true },
    });
    const plan = snapshot ? serializePlan(snapshot) : null;
    if (!plan) throw httpError(404, "Plan not found");
    return { plan };
  });

  app.post("/plans/generate", async (request) => {
    const user = await requireUser(request);
    const snapshot = await generatePlanForUser(user.id);
    return { plan: serializePlan(snapshot) };
  });

  app.get("/snapshots/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const snapshot = await prisma.snapshot.findFirst({
      where: { id, userId: user.id },
      include: { plan: true, chainRecord: true },
    });
    if (!snapshot) throw httpError(404, "Snapshot not found");
    return {
      id: snapshot.id,
      contentHash: snapshot.contentHash,
      canonicalJson: snapshot.canonicalJson,
      createdAt: snapshot.createdAt.toISOString(),
      plan: serializePlan(snapshot),
    };
  });
}
