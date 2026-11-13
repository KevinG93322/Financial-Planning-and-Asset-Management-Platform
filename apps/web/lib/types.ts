export type Household = {
  profile: {
    displayName: string;
    incomeMonthly: number;
    expensesMonthly: number;
    riskTolerance: "conservative" | "moderate" | "growth";
    timeHorizonYears: number;
    notes: string;
  } | null;
  accounts: { id: string; name: string; type: string; balance: number }[];
  goals: {
    id: string;
    name: string;
    targetAmount: number;
    targetDate: string;
    monthlyContribution: number;
  }[];
};

export type PlanAction = {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type Metrics = {
  netWorthCents: number;
  assetsCents: number;
  liabilitiesCents: number;
  savingsMonthlyCents: number;
  savingsRateBps: number;
  cashCents: number;
  allocationBps: { cash: number; brokerage: number; retirement: number; other: number };
};

export type PlanView = {
  id: string;
  snapshotId: string;
  contentHash: string;
  canonicalJson: string;
  createdAt: string;
  source: "ai" | "rules" | string;
  summary: string;
  actions: PlanAction[];
  assumptions: string[];
  disclaimer: string;
  metrics: Metrics;
  verified: boolean;
  txHash: string | null;
  recordId: string | null;
};

export type ChainConfig = {
  chainId: number;
  registry: string;
  asset: string;
  vault: string;
  planRecordType: string;
  consentScope: string;
  deployed: boolean;
};

export type Verification = {
  snapshotId: string;
  contentHash: string;
  recomputedHash: string;
  hashMatchesStored: boolean;
  verified: boolean;
  chainRead: boolean;
  detail: string;
  onChain: { txHash: string; recordId: string; status: string; blockNumber: string } | null;
};

export type PrepareAttestation = {
  snapshotId: string;
  contentHash: string;
  recordType: string;
  consentScope: string;
  contractAddress: string;
  chainId: number;
  canonicalJson: string;
};
