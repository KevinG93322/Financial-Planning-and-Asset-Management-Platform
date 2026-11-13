import type { AccountInput, GoalInput, Metrics, ProfileInput } from "./types";

export function monthsUntil(targetDate: string, now: Date): number {
  const [year, month, day] = targetDate.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((target - start) / 86_400_000);
  if (days <= 0) return 0;
  return Math.max(1, Math.round(days / 30.4375));
}

function shareBps(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part * 10_000) / whole);
}

function sumType(accounts: AccountInput[], type: string): number {
  return accounts.filter((account) => account.type === type).reduce((sum, account) => sum + account.balance, 0);
}

export function computeMetrics(input: {
  profile: ProfileInput;
  accounts: AccountInput[];
  goals: GoalInput[];
  now?: Date;
}): Metrics {
  const now = input.now ?? new Date();
  const assets = input.accounts.filter((account) => account.type !== "liability");
  const liabilities = input.accounts.filter((account) => account.type === "liability");
  const assetsCents = assets.reduce((sum, account) => sum + account.balance, 0);
  const liabilitiesCents = liabilities.reduce((sum, account) => sum + account.balance, 0);
  const income = input.profile.incomeMonthly;
  const expenses = input.profile.expensesMonthly;
  const savings = income - expenses;
  const cashCents = sumType(assets, "cash");
  const brokerageCents = sumType(assets, "brokerage");
  const retirementCents = sumType(assets, "retirement");
  const otherCents = sumType(assets, "other");

  return {
    netWorthCents: assetsCents - liabilitiesCents,
    assetsCents,
    liabilitiesCents,
    incomeMonthlyCents: income,
    expensesMonthlyCents: expenses,
    savingsMonthlyCents: savings,
    savingsRateBps: income > 0 ? Math.round((savings * 10_000) / income) : 0,
    cashCents,
    brokerageCents,
    retirementCents,
    otherCents,
    allocationBps: {
      cash: shareBps(cashCents, assetsCents),
      brokerage: shareBps(brokerageCents, assetsCents),
      retirement: shareBps(retirementCents, assetsCents),
      other: shareBps(otherCents, assetsCents),
    },
    goals: input.goals.map((goal) => {
      const monthsRemaining = monthsUntil(goal.targetDate, now);
      const projected = goal.monthlyContribution * monthsRemaining;
      return {
        name: goal.name,
        targetAmountCents: goal.targetAmount,
        monthlyContributionCents: goal.monthlyContribution,
        monthsRemaining,
        gapCents: Math.max(0, goal.targetAmount - projected),
        onTrack: monthsRemaining > 0 && projected >= goal.targetAmount,
      };
    }),
  };
}
