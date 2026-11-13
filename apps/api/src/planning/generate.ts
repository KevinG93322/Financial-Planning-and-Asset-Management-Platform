import { httpError } from "../http";
import { prisma } from "../prisma";
import { createPlanBody } from "./ai";
import { computeMetrics } from "./metrics";
import { buildCanonicalSnapshot } from "./snapshot";
import type { AccountInput, GoalInput, ProfileInput } from "./types";

const snapshotInclude = { plan: true, chainRecord: true } as const;

export async function generatePlanForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, accounts: true, goals: true },
  });
  if (!user?.profile) {
    throw httpError(400, "Save a household profile before generating a plan");
  }

  const profile: ProfileInput = {
    displayName: user.profile.displayName,
    incomeMonthly: user.profile.incomeMonthly,
    expensesMonthly: user.profile.expensesMonthly,
    riskTolerance: user.profile.riskTolerance,
    timeHorizonYears: user.profile.timeHorizonYears,
    notes: user.profile.notes,
  };
  const accounts: AccountInput[] = user.accounts.map((account) => ({
    name: account.name,
    type: account.type,
    balance: account.balance,
  }));
  const goals: GoalInput[] = user.goals.map((goal) => ({
    name: goal.name,
    targetAmount: goal.targetAmount,
    targetDate: goal.targetDate,
    monthlyContribution: goal.monthlyContribution,
  }));
  const metrics = computeMetrics({ profile, accounts, goals });
  const { body, source } = await createPlanBody(metrics, profile);
  const built = buildCanonicalSnapshot({
    address: user.address,
    profile,
    accounts,
    goals,
    metrics,
    plan: { ...body, source },
  });

  return prisma.snapshot.create({
    data: {
      userId,
      canonicalJson: built.canonicalJson,
      contentHash: built.contentHash,
      plan: {
        create: {
          summary: body.summary,
          actionsJson: JSON.stringify(body.actions),
          assumptionsJson: JSON.stringify(body.assumptions),
          disclaimer: body.disclaimer,
          source,
          metricsJson: JSON.stringify(metrics),
        },
      },
    },
    include: snapshotInclude,
  });
}

export type SnapshotWithPlan = NonNullable<Awaited<ReturnType<typeof generatePlanForUser>>>;

export function serializePlan(snapshot: {
  id: string;
  contentHash: string;
  canonicalJson: string;
  createdAt: Date;
  plan: {
    id: string;
    summary: string;
    actionsJson: string;
    assumptionsJson: string;
    disclaimer: string;
    source: string;
    metricsJson: string;
  } | null;
  chainRecord: { status: string; txHash: string; recordId: string } | null;
}) {
  if (!snapshot.plan) return null;
  return {
    id: snapshot.plan.id,
    snapshotId: snapshot.id,
    contentHash: snapshot.contentHash,
    canonicalJson: snapshot.canonicalJson,
    createdAt: snapshot.createdAt.toISOString(),
    source: snapshot.plan.source,
    summary: snapshot.plan.summary,
    actions: JSON.parse(snapshot.plan.actionsJson) as unknown,
    assumptions: JSON.parse(snapshot.plan.assumptionsJson) as unknown,
    disclaimer: snapshot.plan.disclaimer,
    metrics: JSON.parse(snapshot.plan.metricsJson) as unknown,
    verified: snapshot.chainRecord?.status === "verified",
    txHash: snapshot.chainRecord?.txHash ?? null,
    recordId: snapshot.chainRecord?.recordId ?? null,
  };
}
