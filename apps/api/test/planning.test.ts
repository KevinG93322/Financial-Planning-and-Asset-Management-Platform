import { DISCLAIMER, contentHash } from "@fp/shared";
import { describe, expect, it } from "vitest";
import { createPlanBody, parseAiPlan } from "../src/planning/ai";
import { computeMetrics, monthsUntil } from "../src/planning/metrics";
import { buildRulesPlan } from "../src/planning/rules";
import { buildCanonicalSnapshot } from "../src/planning/snapshot";
import type { ProfileInput } from "../src/planning/types";

const now = new Date("2026-11-12T15:00:00.000Z");

const profile: ProfileInput = {
  displayName: "Alex Rivera",
  incomeMonthly: 850_000,
  expensesMonthly: 620_000,
  riskTolerance: "moderate",
  timeHorizonYears: 15,
  notes: "Sample",
};

const accounts = [
  { name: "Checking", type: "cash", balance: 1_200_000 },
  { name: "Brokerage", type: "brokerage", balance: 4_500_000 },
  { name: "Retirement", type: "retirement", balance: 2_800_000 },
  { name: "Mortgage", type: "liability", balance: 18_000_000 },
];

const goals = [
  { name: "Emergency fund", targetAmount: 2_500_000, targetDate: "2028-05-12", monthlyContribution: 80_000 },
  { name: "Long-term portfolio", targetAmount: 10_000_000, targetDate: "2036-11-12", monthlyContribution: 40_000 },
];

describe("planning engine", () => {
  it("computes net worth, savings rate, allocation, and goal gaps", () => {
    expect(monthsUntil("2028-05-12", now)).toBe(18);
    expect(monthsUntil("2036-11-12", now)).toBe(120);
    expect(monthsUntil("2026-11-12", now)).toBe(0);

    const metrics = computeMetrics({ profile, accounts, goals, now });
    expect(metrics.assetsCents).toBe(8_500_000);
    expect(metrics.liabilitiesCents).toBe(18_000_000);
    expect(metrics.netWorthCents).toBe(-9_500_000);
    expect(metrics.savingsMonthlyCents).toBe(230_000);
    expect(metrics.savingsRateBps).toBe(2706);
    expect(metrics.allocationBps).toEqual({ cash: 1412, brokerage: 5294, retirement: 3294, other: 0 });
    expect(metrics.goals[0]).toMatchObject({ monthsRemaining: 18, gapCents: 1_060_000, onTrack: false });
    expect(metrics.goals[1]).toMatchObject({ monthsRemaining: 120, gapCents: 5_200_000, onTrack: false });
  });

  it("marks a past goal as off track", () => {
    const metrics = computeMetrics({
      profile,
      accounts: [],
      goals: [{ name: "Old", targetAmount: 100, targetDate: "2020-01-01", monthlyContribution: 100 }],
      now,
    });
    expect(metrics.goals[0]).toMatchObject({ monthsRemaining: 0, gapCents: 100, onTrack: false });
  });

  it("builds a rules plan from the household figures", () => {
    const metrics = computeMetrics({ profile, accounts, goals, now });
    const plan = buildRulesPlan(metrics, profile);
    expect(plan.disclaimer).toBe(DISCLAIMER);
    expect(plan.actions.map((action) => action.title)).toEqual([
      "Net worth is below zero",
      "Monthly surplus is in good shape",
      "Build the cash reserve",
      "Emergency fund is behind the stated contribution",
      "Long-term portfolio is behind the stated contribution",
    ]);
    expect(plan.summary).toContain("-$95,000.00");
    expect(plan.summary).toContain("27.1%");
  });

  it("hashes the same snapshot when account order changes", () => {
    const metrics = computeMetrics({ profile, accounts, goals, now });
    const plan = { ...buildRulesPlan(metrics, profile), source: "rules" as const };
    const forward = buildCanonicalSnapshot({
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      profile,
      accounts,
      goals,
      metrics,
      plan,
    });
    const reversed = buildCanonicalSnapshot({
      address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      profile,
      accounts: [...accounts].reverse(),
      goals: [...goals].reverse(),
      metrics,
      plan,
    });
    expect(reversed.contentHash).toBe(forward.contentHash);
    expect(reversed.canonicalJson).toBe(forward.canonicalJson);
    expect(contentHash(JSON.parse(forward.canonicalJson))).toBe(forward.contentHash);
  });

  it("parses an AI plan and falls back to rules without a key", async () => {
    const parsed = parseAiPlan(
      "```json\n" +
        JSON.stringify({
          summary: "A short note",
          actions: [{ title: "Hold cash", detail: "Keep the reserve.", priority: "medium" }],
          assumptions: ["Figures were supplied."],
          disclaimer: "model text",
        }) +
        "\n```",
    );
    expect(parsed.summary).toBe("A short note");
    expect(parsed.disclaimer).toBe(DISCLAIMER);
    expect(() => parseAiPlan("not json")).toThrow();

    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const metrics = computeMetrics({ profile, accounts, goals, now });
    const chosen = await createPlanBody(metrics, profile);
    expect(chosen.source).toBe("rules");
    if (previous) process.env.OPENAI_API_KEY = previous;
  });
});
