import { DISCLAIMER, formatPercentFromBps, formatUsd } from "@fp/shared";
import type { Metrics, PlanBody, ProfileInput } from "./types";

export function buildRulesPlan(metrics: Metrics, profile: ProfileInput): PlanBody {
  const actions: PlanBody["actions"] = [];
  const savingsLabel = formatUsd(metrics.savingsMonthlyCents);
  const rateLabel = formatPercentFromBps(metrics.savingsRateBps);

  if (metrics.netWorthCents < 0) {
    actions.push({
      priority: "high",
      title: "Net worth is below zero",
      detail: `Assets of ${formatUsd(metrics.assetsCents)} are below liabilities of ${formatUsd(metrics.liabilitiesCents)}. Direct surplus to the highest-interest balances before adding investment contributions.`,
    });
  }

  if (metrics.savingsMonthlyCents < 0) {
    actions.push({
      priority: "high",
      title: "Monthly spending exceeds income",
      detail: `Expenses exceed income by ${formatUsd(Math.abs(metrics.savingsMonthlyCents))} each month. A plan starts by bringing that gap to zero.`,
    });
  } else if (metrics.savingsRateBps < 2000) {
    actions.push({
      priority: "high",
      title: "Raise the monthly savings rate",
      detail: `The current surplus is ${savingsLabel}, or ${rateLabel} of income. A 20.0% surplus is a working target for this simulation.`,
    });
  } else {
    actions.push({
      priority: "medium",
      title: "Monthly surplus is in good shape",
      detail: `The surplus is ${savingsLabel}, or ${rateLabel} of income, which clears the 20.0% illustration target.`,
    });
  }

  const reserveMonths = profile.riskTolerance === "conservative" ? 6 : 3;
  const reserveTarget = profile.expensesMonthly * reserveMonths;
  if (metrics.cashCents < reserveTarget) {
    actions.push({
      priority: "high",
      title: "Build the cash reserve",
      detail: `Cash is ${formatUsd(metrics.cashCents)}. A ${reserveMonths}-month reserve of expenses is ${formatUsd(reserveTarget)}.`,
    });
  } else if (
    (profile.riskTolerance === "moderate" || profile.riskTolerance === "growth") &&
    profile.timeHorizonYears >= 5 &&
    metrics.allocationBps.cash > 4000
  ) {
    actions.push({
      priority: "medium",
      title: "Cash is a large share of assets",
      detail: `Cash is ${formatPercentFromBps(metrics.allocationBps.cash)} of assets after the reserve target is met. The ${profile.timeHorizonYears}-year horizon can hold a smaller cash share in this illustration.`,
    });
  }

  for (const goal of metrics.goals) {
    if (goal.onTrack) {
      actions.push({
        priority: "low",
        title: `${goal.name} is covered by the stated contribution`,
        detail: `${formatUsd(goal.monthlyContributionCents)} a month reaches ${formatUsd(goal.targetAmountCents)} within ${goal.monthsRemaining} months in this illustration.`,
      });
    } else {
      actions.push({
        priority: "high",
        title: `${goal.name} is behind the stated contribution`,
        detail: `The gap is ${formatUsd(goal.gapCents)} over ${goal.monthsRemaining} months at ${formatUsd(goal.monthlyContributionCents)} a month.`,
      });
    }
  }

  if (actions.length === 0) {
    actions.push({
      priority: "low",
      title: "Add accounts and goals",
      detail: "The household has no balances or goals yet, so the illustration stays empty.",
    });
  }

  return {
    summary: `Monthly surplus is ${savingsLabel} (${rateLabel}). Net worth is ${formatUsd(metrics.netWorthCents)} across a ${profile.timeHorizonYears}-year horizon with ${profile.riskTolerance} risk.`,
    actions,
    assumptions: [
      "Balances, income, and goals are the figures you entered and are not read from a bank or broker.",
      "Goal timing counts a 30.44-day month and does not assume investment returns.",
      "Demo vault tokens are separate from these household figures and have no monetary value.",
    ],
    disclaimer: DISCLAIMER,
  };
}
