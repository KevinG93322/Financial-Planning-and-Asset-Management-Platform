export type ProfileInput = {
  displayName: string;
  incomeMonthly: number;
  expensesMonthly: number;
  riskTolerance: string;
  timeHorizonYears: number;
  notes: string;
};

export type AccountInput = {
  name: string;
  type: string;
  balance: number;
};

export type GoalInput = {
  name: string;
  targetAmount: number;
  targetDate: string;
  monthlyContribution: number;
};

export type GoalMetric = {
  name: string;
  targetAmountCents: number;
  monthlyContributionCents: number;
  monthsRemaining: number;
  gapCents: number;
  onTrack: boolean;
};

export type Metrics = {
  netWorthCents: number;
  assetsCents: number;
  liabilitiesCents: number;
  incomeMonthlyCents: number;
  expensesMonthlyCents: number;
  savingsMonthlyCents: number;
  savingsRateBps: number;
  cashCents: number;
  brokerageCents: number;
  retirementCents: number;
  otherCents: number;
  allocationBps: {
    cash: number;
    brokerage: number;
    retirement: number;
    other: number;
  };
  goals: GoalMetric[];
};

export type PlanAction = {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type PlanBody = {
  summary: string;
  actions: PlanAction[];
  assumptions: string[];
  disclaimer: string;
};

export type StoredPlan = PlanBody & {
  source: "ai" | "rules";
};
