"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPercentFromBps, formatUsd } from "@fp/shared";
import { useAuth } from "../components/AuthProvider";
import { api } from "../lib/api";
import type { Household, PlanView } from "../lib/types";
import { demoSigner, injectedSigner, setSignerMode } from "../lib/wallet";

export default function HomePage() {
  const { user, loading } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    void (async () => {
      try {
        const [home, plans] = await Promise.all([
          api<Household>("/household"),
          api<{ plans: PlanView[] }>("/plans"),
        ]);
        if (!cancel) {
          setHousehold(home);
          setPlan(plans.plans[0] ?? null);
        }
      } catch (caught) {
        if (!cancel) setError(caught instanceof Error ? caught.message : "Could not load the overview");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  async function signIn(mode: "demo" | "injected") {
    setBusy(true);
    setError("");
    try {
      setSignerMode(mode);
      const signer = mode === "demo" ? demoSigner() : await injectedSigner();
      const address = await signer.getAddress();
      const nonce = await api<{ message: string }>("/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ address }),
      });
      const signature = await signer.signMessage(nonce.message);
      await api("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ address, message: nonce.message, signature }),
      });
      window.location.href = "/household";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="note">Checking session…</p>;
  }

  if (!user) {
    return (
      <div className="split">
        <section>
          <p className="kicker">Local planning desk</p>
          <h1>A household plan with a hash you can attest.</h1>
          <p className="intro">
            Enter income, balances, and goals. The API writes an educational plan, stores the canonical snapshot in
            PostgreSQL, and asks your wallet to attest the hash on a local Hardhat chain.
          </p>
          <ol className="steps">
            <li>Sign in with the funded Hardhat account or MetaMask on chain 31337.</li>
            <li>Save a household, or load the fictional sample.</li>
            <li>Generate a plan, record its hash, and move demo vault tokens.</li>
          </ol>
        </section>
        <section className="card stack">
          <h2>Sign in</h2>
          <p className="note">The signature opens a session. It does not approve a transfer.</p>
          {error ? <p className="alert">{error}</p> : null}
          <button type="button" disabled={busy} onClick={() => void signIn("demo")}>
            Sign in with Hardhat account
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void signIn("injected")}>
            Sign in with MetaMask
          </button>
        </section>
      </div>
    );
  }

  return (
    <section>
      <p className="kicker">Overview</p>
      <h1>{household?.profile?.displayName ?? "Your desk"}</h1>
      <p className="intro">Pick up the household, the latest plan, or the demo vault.</p>
      {error ? <p className="alert">{error}</p> : null}
      <div className="stat-row">
        <article className="card stat">
          <span>Household</span>
          <strong>{household?.profile ? "Saved" : "Empty"}</strong>
        </article>
        <article className="card stat">
          <span>Latest plan</span>
          <strong>{plan ? formatUsd(plan.metrics.netWorthCents) : "None"}</strong>
        </article>
        <article className="card stat">
          <span>Attestation</span>
          <strong>{plan?.verified ? "Verified" : "Open"}</strong>
        </article>
      </div>
      {plan ? (
        <p className="note">
          Surplus {formatUsd(plan.metrics.savingsMonthlyCents)} · {formatPercentFromBps(plan.metrics.savingsRateBps)} ·{" "}
          {plan.source === "ai" ? "AI draft" : "Rules draft"}
        </p>
      ) : null}
      <div className="actions">
        <Link className="button" href="/household">
          Edit household
        </Link>
        <Link className="button secondary" href="/plan">
          Open plan
        </Link>
        <Link className="button secondary" href="/vault">
          Open vault
        </Link>
      </div>
    </section>
  );
}
