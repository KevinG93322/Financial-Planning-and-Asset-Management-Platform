import type { AccountInput, GoalInput, ProfileInput } from "./types";

function addUtcMonths(now: Date, months: number): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate()));
  return date.toISOString().slice(0, 10);
}

export function sampleHousehold(now = new Date()): {
  profile: ProfileInput;
  accounts: AccountInput[];
  goals: GoalInput[];
} {
  return {
    profile: {
      displayName: "Alex Rivera",
      incomeMonthly: 850_000,
      expensesMonthly: 620_000,
      riskTolerance: "moderate",
      timeHorizonYears: 15,
      notes: "Sample household for the local demo. Figures are fictional.",
    },
    accounts: [
      { name: "Checking", type: "cash", balance: 1_200_000 },
      { name: "Brokerage", type: "brokerage", balance: 4_500_000 },
      { name: "Retirement", type: "retirement", balance: 2_800_000 },
      { name: "Mortgage", type: "liability", balance: 18_000_000 },
    ],
    goals: [
      {
        name: "Emergency fund",
        targetAmount: 2_500_000,
        targetDate: addUtcMonths(now, 18),
        monthlyContribution: 80_000,
      },
      {
        name: "Long-term portfolio",
        targetAmount: 10_000_000,
        targetDate: addUtcMonths(now, 120),
        monthlyContribution: 40_000,
      },
    ],
  };
}
