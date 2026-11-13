import { canonicalize, contentHash } from "@fp/shared";
import { getAddress } from "ethers";
import type { AccountInput, GoalInput, Metrics, ProfileInput, StoredPlan } from "./types";

export function buildCanonicalSnapshot(input: {
  address: string;
  profile: ProfileInput;
  accounts: AccountInput[];
  goals: GoalInput[];
  metrics: Metrics;
  plan: StoredPlan;
}): { canonicalJson: string; contentHash: string } {
  const accounts = [...input.accounts].sort(
    (left, right) => left.name.localeCompare(right.name) || left.type.localeCompare(right.type),
  );
  const goals = [...input.goals].sort(
    (left, right) => left.name.localeCompare(right.name) || left.targetDate.localeCompare(right.targetDate),
  );
  const snapshot = {
    version: 1,
    address: getAddress(input.address).toLowerCase(),
    profile: {
      displayName: input.profile.displayName,
      incomeMonthly: input.profile.incomeMonthly,
      expensesMonthly: input.profile.expensesMonthly,
      riskTolerance: input.profile.riskTolerance,
      timeHorizonYears: input.profile.timeHorizonYears,
      notes: input.profile.notes,
    },
    accounts,
    goals,
    metrics: input.metrics,
    plan: input.plan,
  };
  const canonicalJson = canonicalize(snapshot);
  return {
    canonicalJson,
    contentHash: contentHash(JSON.parse(canonicalJson)),
  };
}
