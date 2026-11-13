import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { httpError } from "../http";
import { prisma } from "../prisma";
import { sampleHousehold } from "../planning/sample";
import { requireUser } from "./auth";
import { accountSchema, goalSchema, householdSchema, profileSchema } from "../schemas";

async function saveHousehold(
  userId: string,
  payload: z.infer<typeof householdSchema>,
) {
  await prisma.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { userId },
      update: payload.profile,
      create: { userId, ...payload.profile },
    });
    await tx.account.deleteMany({ where: { userId } });
    if (payload.accounts.length > 0) {
      await tx.account.createMany({
        data: payload.accounts.map((account) => ({ userId, ...account })),
      });
    }
    await tx.goal.deleteMany({ where: { userId } });
    if (payload.goals.length > 0) {
      await tx.goal.createMany({
        data: payload.goals.map((goal) => ({ userId, ...goal })),
      });
    }
  });
}

async function loadHousehold(userId: string) {
  const [profile, accounts, goals] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);
  return {
    profile: profile
      ? {
          displayName: profile.displayName,
          incomeMonthly: profile.incomeMonthly,
          expensesMonthly: profile.expensesMonthly,
          riskTolerance: profile.riskTolerance,
          timeHorizonYears: profile.timeHorizonYears,
          notes: profile.notes,
        }
      : null,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      monthlyContribution: goal.monthlyContribution,
    })),
  };
}

export async function householdRoutes(app: FastifyInstance) {
  app.get("/household", async (request) => {
    const user = await requireUser(request);
    return loadHousehold(user.id);
  });

  app.put("/household", async (request) => {
    const user = await requireUser(request);
    const payload = householdSchema.parse(request.body);
    await saveHousehold(user.id, payload);
    return loadHousehold(user.id);
  });

  app.post("/household/sample", async (request) => {
    const user = await requireUser(request);
    const payload = householdSchema.parse(sampleHousehold());
    await saveHousehold(user.id, payload);
    return loadHousehold(user.id);
  });

  app.get("/profile", async (request) => {
    const user = await requireUser(request);
    const household = await loadHousehold(user.id);
    return { profile: household.profile };
  });

  app.put("/profile", async (request) => {
    const user = await requireUser(request);
    const profile = profileSchema.parse(request.body);
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { userId: user.id, ...profile },
    });
    return { profile };
  });

  app.get("/accounts", async (request) => {
    const user = await requireUser(request);
    const household = await loadHousehold(user.id);
    return { accounts: household.accounts };
  });

  app.post("/accounts", async (request) => {
    const user = await requireUser(request);
    const body = accountSchema.parse(request.body);
    const account = await prisma.account.create({ data: { userId: user.id, ...body } });
    return { account };
  });

  app.patch("/accounts/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const body = accountSchema.partial().parse(request.body);
    const existing = await prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw httpError(404, "Account not found");
    const account = await prisma.account.update({ where: { id }, data: body });
    return { account };
  });

  app.delete("/accounts/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const existing = await prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw httpError(404, "Account not found");
    await prisma.account.delete({ where: { id } });
    return { ok: true };
  });

  app.get("/goals", async (request) => {
    const user = await requireUser(request);
    const household = await loadHousehold(user.id);
    return { goals: household.goals };
  });

  app.post("/goals", async (request) => {
    const user = await requireUser(request);
    const body = goalSchema.parse(request.body);
    const goal = await prisma.goal.create({ data: { userId: user.id, ...body } });
    return { goal };
  });

  app.patch("/goals/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const body = goalSchema.partial().parse(request.body);
    const existing = await prisma.goal.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw httpError(404, "Goal not found");
    const goal = await prisma.goal.update({ where: { id }, data: body });
    return { goal };
  });

  app.delete("/goals/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const existing = await prisma.goal.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw httpError(404, "Goal not found");
    await prisma.goal.delete({ where: { id } });
    return { ok: true };
  });
}
