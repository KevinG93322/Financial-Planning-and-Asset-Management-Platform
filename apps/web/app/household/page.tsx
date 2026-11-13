"use client";

import { centsToDollarInput, dollarsToCents, formatUsd } from "@fp/shared";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { api } from "../../lib/api";
import type { Household } from "../../lib/types";

const accountTypes = [
  ["cash", "Cash"],
  ["brokerage", "Brokerage"],
  ["retirement", "Retirement"],
  ["other", "Other asset"],
  ["liability", "Liability"],
] as const;

type AccountDraft = { key: string; name: string; type: string; balance: string };
type GoalDraft = { key: string; name: string; target: string; date: string; monthly: string };
type FormState = {
  displayName: string;
  income: string;
  expenses: string;
  riskTolerance: "conservative" | "moderate" | "growth";
  timeHorizonYears: string;
  notes: string;
  accounts: AccountDraft[];
  goals: GoalDraft[];
};

function blankForm(): FormState {
  return {
    displayName: "",
    income: "",
    expenses: "",
    riskTolerance: "moderate",
    timeHorizonYears: "10",
    notes: "",
    accounts: [],
    goals: [],
  };
}

function toForm(household: Household): FormState {
  if (!household.profile) return blankForm();
  return {
    displayName: household.profile.displayName,
    income: centsToDollarInput(household.profile.incomeMonthly),
    expenses: centsToDollarInput(household.profile.expensesMonthly),
    riskTolerance: household.profile.riskTolerance,
    timeHorizonYears: String(household.profile.timeHorizonYears),
    notes: household.profile.notes,
    accounts: household.accounts.map((account) => ({
      key: account.id,
      name: account.name,
      type: account.type,
      balance: centsToDollarInput(account.balance),
    })),
    goals: household.goals.map((goal) => ({
      key: goal.id,
      name: goal.name,
      target: centsToDollarInput(goal.targetAmount),
      date: goal.targetDate,
      monthly: centsToDollarInput(goal.monthlyContribution),
    })),
  };
}

function centsOrThrow(input: string, label: string): number {
  const cents = dollarsToCents(input.trim() || "0");
  if (cents < 0) throw new Error(`${label} cannot be negative`);
  return cents;
}

export default function HouseholdPage() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState<FormState>(blankForm);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    void (async () => {
      try {
        const household = await api<Household>("/household");
        if (cancel) return;
        if (household.profile) {
          setForm(toForm(household));
          setEditing(true);
        }
      } catch (caught) {
        if (!cancel) setError(caught instanceof Error ? caught.message : "Could not load the household");
      } finally {
        if (!cancel) setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  async function loadSample() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const household = await api<Household>("/household/sample", { method: "POST" });
      setForm(toForm(household));
      setEditing(true);
      setMessage("Sample household loaded. Saved plans stay as history.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the sample");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const horizon = Number(form.timeHorizonYears);
      if (!Number.isInteger(horizon) || horizon < 1 || horizon > 60) {
        throw new Error("Time horizon must be a whole number from 1 to 60");
      }
      const payload = {
        profile: {
          displayName: form.displayName.trim(),
          incomeMonthly: centsOrThrow(form.income, "Income"),
          expensesMonthly: centsOrThrow(form.expenses, "Expenses"),
          riskTolerance: form.riskTolerance,
          timeHorizonYears: horizon,
          notes: form.notes,
        },
        accounts: form.accounts.map((account) => ({
          name: account.name.trim(),
          type: account.type,
          balance: centsOrThrow(account.balance, account.name || "Account balance"),
        })),
        goals: form.goals.map((goal) => {
          const targetAmount = centsOrThrow(goal.target, goal.name || "Goal target");
          if (targetAmount <= 0) throw new Error("Goal target must be greater than zero");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(goal.date)) throw new Error("Each goal needs a target date");
          return {
            name: goal.name.trim(),
            targetAmount,
            targetDate: goal.date,
            monthlyContribution: centsOrThrow(goal.monthly, goal.name || "Monthly contribution"),
          };
        }),
      };
      const household = await api<Household>("/household", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setForm(toForm(household));
      setMessage("Household saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the household");
    } finally {
      setBusy(false);
    }
  }

  if (loading || (user && !ready)) return <p className="note">Loading household…</p>;
  if (!user) return <p className="note">Sign in from the home page to edit a household.</p>;

  const safeCents = (input: string) => {
    try {
      return Math.max(0, dollarsToCents(input.trim() || "0"));
    } catch {
      return 0;
    }
  };
  const assetCents = form.accounts
    .filter((account) => account.type !== "liability")
    .reduce((sum, account) => sum + safeCents(account.balance), 0);
  const debtCents = form.accounts
    .filter((account) => account.type === "liability")
    .reduce((sum, account) => sum + safeCents(account.balance), 0);

  return (
    <section className="stack">
      <div>
        <p className="kicker">Household</p>
        <h1>Figures that stay off chain</h1>
        <p className="intro">
          Income, balances, and goals are stored in PostgreSQL. A later attestation commits only a hash of the canonical
          snapshot.
        </p>
      </div>
      {error ? <p className="alert">{error}</p> : null}
      {message ? <p className="note">{message}</p> : null}
      {!editing ? (
        <div className="card empty stack">
          <h2>No profile yet</h2>
          <p className="note">Load the fictional Rivera household, or start with an empty form.</p>
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => void loadSample()}>
              Load sample household
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setForm(blankForm());
                setEditing(true);
              }}
            >
              Start a blank household
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="stat-row">
            <article className="card stat">
              <span>Assets entered</span>
              <strong>{formatUsd(assetCents)}</strong>
            </article>
            <article className="card stat">
              <span>Liabilities entered</span>
              <strong>{formatUsd(debtCents)}</strong>
            </article>
            <article className="card stat">
              <span>Net of entries</span>
              <strong>{formatUsd(assetCents - debtCents)}</strong>
            </article>
          </div>
          <div className="card form-grid">
            <div className="row">
              <label>
                Name
                <input
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                />
              </label>
              <label>
                Monthly income
                <input
                  inputMode="decimal"
                  value={form.income}
                  onChange={(event) => setForm({ ...form, income: event.target.value })}
                />
              </label>
              <label>
                Monthly expenses
                <input
                  inputMode="decimal"
                  value={form.expenses}
                  onChange={(event) => setForm({ ...form, expenses: event.target.value })}
                />
              </label>
            </div>
            <div className="row">
              <label>
                Risk
                <select
                  value={form.riskTolerance}
                  onChange={(event) =>
                    setForm({ ...form, riskTolerance: event.target.value as FormState["riskTolerance"] })
                  }
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="growth">Growth</option>
                </select>
              </label>
              <label>
                Horizon (years)
                <input
                  inputMode="numeric"
                  value={form.timeHorizonYears}
                  onChange={(event) => setForm({ ...form, timeHorizonYears: event.target.value })}
                />
              </label>
            </div>
            <label>
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
          </div>

          <div className="card stack">
            <h2>Accounts</h2>
            {form.accounts.map((account, index) => (
              <div className="row" key={account.key}>
                <label>
                  Name
                  <input
                    value={account.name}
                    onChange={(event) => {
                      const accounts = [...form.accounts];
                      accounts[index] = { ...account, name: event.target.value };
                      setForm({ ...form, accounts });
                    }}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={account.type}
                    onChange={(event) => {
                      const accounts = [...form.accounts];
                      accounts[index] = { ...account, type: event.target.value };
                      setForm({ ...form, accounts });
                    }}
                  >
                    {accountTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Balance
                  <input
                    inputMode="decimal"
                    value={account.balance}
                    onChange={(event) => {
                      const accounts = [...form.accounts];
                      accounts[index] = { ...account, balance: event.target.value };
                      setForm({ ...form, accounts });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setForm({ ...form, accounts: form.accounts.filter((row) => row.key !== account.key) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setForm({
                  ...form,
                  accounts: [...form.accounts, { key: crypto.randomUUID(), name: "", type: "cash", balance: "" }],
                })
              }
            >
              Add account
            </button>
          </div>

          <div className="card stack">
            <h2>Goals</h2>
            {form.goals.map((goal, index) => (
              <div className="row goal-row" key={goal.key}>
                <label>
                  Name
                  <input
                    value={goal.name}
                    onChange={(event) => {
                      const goals = [...form.goals];
                      goals[index] = { ...goal, name: event.target.value };
                      setForm({ ...form, goals });
                    }}
                  />
                </label>
                <label>
                  Target
                  <input
                    inputMode="decimal"
                    value={goal.target}
                    onChange={(event) => {
                      const goals = [...form.goals];
                      goals[index] = { ...goal, target: event.target.value };
                      setForm({ ...form, goals });
                    }}
                  />
                </label>
                <label>
                  Target date
                  <input
                    type="date"
                    value={goal.date}
                    onChange={(event) => {
                      const goals = [...form.goals];
                      goals[index] = { ...goal, date: event.target.value };
                      setForm({ ...form, goals });
                    }}
                  />
                </label>
                <label>
                  Monthly
                  <input
                    inputMode="decimal"
                    value={goal.monthly}
                    onChange={(event) => {
                      const goals = [...form.goals];
                      goals[index] = { ...goal, monthly: event.target.value };
                      setForm({ ...form, goals });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setForm({ ...form, goals: form.goals.filter((row) => row.key !== goal.key) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setForm({
                  ...form,
                  goals: [...form.goals, { key: crypto.randomUUID(), name: "", target: "", date: "", monthly: "" }],
                })
              }
            >
              Add goal
            </button>
          </div>

          <div className="actions">
            <button type="button" disabled={busy} onClick={() => void save()}>
              Save household
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => void loadSample()}>
              Replace with sample household
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
