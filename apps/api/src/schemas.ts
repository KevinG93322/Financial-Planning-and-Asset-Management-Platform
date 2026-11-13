import { z } from "zod";

const dollarAmount = z.number().int().nonnegative().max(100_000_000_000);

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(80),
  incomeMonthly: dollarAmount,
  expensesMonthly: dollarAmount,
  riskTolerance: z.enum(["conservative", "moderate", "growth"]),
  timeHorizonYears: z.number().int().min(1).max(60),
  notes: z.string().max(2000).optional().default(""),
});

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(80),
  type: z.enum(["cash", "brokerage", "retirement", "other", "liability"]),
  balance: dollarAmount,
});

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Goal name is required").max(80),
  targetAmount: z.number().int().positive().max(100_000_000_000),
  targetDate: z.string().refine(isIsoDate, "Use a real YYYY-MM-DD date"),
  monthlyContribution: dollarAmount,
});

export const householdSchema = z.object({
  profile: profileSchema,
  accounts: z.array(accountSchema).max(50),
  goals: z.array(goalSchema).max(50),
});

export const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Transaction hash is invalid");
