"use client";

import { contentHash, formatPercentFromBps, formatUsd, registryAbi } from "@fp/shared";
import { Contract } from "ethers";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { api } from "../../lib/api";
import type { ChainConfig, PlanView, PrepareAttestation, Verification } from "../../lib/types";
import { getActiveSigner } from "../../lib/wallet";

function shortHash(value: string): string {
  return value.length < 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export default function PlanPage() {
  const { user, loading } = useAuth();
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [config, setConfig] = useState<ChainConfig | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    void (async () => {
      try {
        const [plans, chain] = await Promise.all([
          api<{ plans: PlanView[] }>("/plans"),
          api<ChainConfig>("/chain/config"),
        ]);
        if (cancel) return;
        setPlan(plans.plans[0] ?? null);
        setConfig(chain);
      } catch (caught) {
        if (!cancel) setError(caught instanceof Error ? caught.message : "Could not load plans");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  async function generate() {
    setBusy(true);
    setError("");
    setStatus("");
    setVerification(null);
    try {
      const result = await api<{ plan: PlanView }>("/plans/generate", { method: "POST" });
      setPlan(result.plan);
      setStatus(result.plan.source === "ai" ? "Plan drafted with the AI provider." : "Plan drafted from the rules engine.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate a plan");
    } finally {
      setBusy(false);
    }
  }

  async function record() {
    if (!plan || !user) return;
    setBusy(true);
    setError("");
    try {
      setStatus("Preparing the snapshot hash");
      const prepared = await api<PrepareAttestation>(`/snapshots/${plan.snapshotId}/prepare`, { method: "POST" });
      const localHash = contentHash(JSON.parse(prepared.canonicalJson));
      if (localHash.toLowerCase() !== prepared.contentHash.toLowerCase()) {
        throw new Error("Local hash does not match the snapshot stored by the API.");
      }
      const signer = await getActiveSigner();
      const address = await signer.getAddress();
      if (address.toLowerCase() !== user.address.toLowerCase()) {
        throw new Error("Connected wallet does not match the signed-in account.");
      }
      const registry = new Contract(prepared.contractAddress, registryAbi, signer);
      const registered = (await registry.registered(address)) as boolean;
      if (!registered) {
        setStatus("Registering this wallet");
        await (await registry.register()).wait();
      }
      const granted = (await registry.consent(address, prepared.consentScope)) as boolean;
      if (!granted) {
        setStatus("Granting planning-data consent");
        await (await registry.setConsent(prepared.consentScope, true)).wait();
      }
      setStatus("Signing the attestation");
      const tx = await registry.attest(prepared.contentHash, prepared.recordType);
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Attestation was not mined");
      setStatus("Checking the receipt");
      await api("/chain/confirm", {
        method: "POST",
        body: JSON.stringify({ snapshotId: plan.snapshotId, txHash: receipt.hash }),
      });
      const check = await api<Verification>(`/snapshots/${plan.snapshotId}/verification`);
      setVerification(check);
      setPlan({ ...plan, verified: check.verified, txHash: check.onChain?.txHash ?? receipt.hash });
      setStatus(check.detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Attestation failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="note">Loading plan…</p>;
  if (!user) return <p className="note">Sign in from the home page to generate a plan.</p>;

  return (
    <section className="stack">
      <div>
        <p className="kicker">Plan</p>
        <h1>An educational snapshot</h1>
        <p className="intro">
          Metrics are calculated in the API. An AI provider writes the narrative when a key is configured. Otherwise the
          same JSON shape comes from the rules engine.
        </p>
      </div>
      {error ? <p className="alert">{error}</p> : null}
      {status ? <p className="note">{status}</p> : null}
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void generate()}>
          Generate plan
        </button>
        <button type="button" className="secondary" disabled={busy || !plan || !config?.deployed} onClick={() => void record()}>
          Record on chain
        </button>
      </div>
      {config && !config.deployed ? (
        <p className="note">Deploy the local contracts before recording a hash. The plan can still be generated.</p>
      ) : null}
      {!plan ? (
        <div className="card empty">
          <h2>No plan yet</h2>
          <p className="note">Save a household, then generate a plan from those figures.</p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <article className="card stat">
              <span>Net worth</span>
              <strong>{formatUsd(plan.metrics.netWorthCents)}</strong>
            </article>
            <article className="card stat">
              <span>Monthly surplus</span>
              <strong>{formatUsd(plan.metrics.savingsMonthlyCents)}</strong>
            </article>
            <article className="card stat">
              <span>Savings rate</span>
              <strong>{formatPercentFromBps(plan.metrics.savingsRateBps)}</strong>
            </article>
          </div>
          <article className="card">
            <div className="actions">
              <span className={plan.verified || verification?.verified ? "pill ok" : "pill"}>
                {plan.verified || verification?.verified ? "Verified" : "Unverified"}
              </span>
              <span className="pill">{plan.source === "ai" ? "AI draft" : "Rules draft"}</span>
            </div>
            <h2 style={{ marginTop: 16 }}>{plan.summary}</h2>
            <div className="bar" aria-hidden="true">
              <i className="cash" style={{ width: `${plan.metrics.allocationBps.cash / 100}%` }} />
              <i className="brokerage" style={{ width: `${plan.metrics.allocationBps.brokerage / 100}%` }} />
              <i className="retirement" style={{ width: `${plan.metrics.allocationBps.retirement / 100}%` }} />
              <i className="other" style={{ width: `${plan.metrics.allocationBps.other / 100}%` }} />
            </div>
            <div className="legend">
              <span><b className="cash" style={{ background: "#1d5c43" }} /> Cash</span>
              <span><b style={{ background: "#c4a574" }} /> Brokerage</span>
              <span><b style={{ background: "#9a4630" }} /> Retirement</span>
              <span><b style={{ background: "#23486e" }} /> Other</span>
            </div>
            <p className="hash">Snapshot {shortHash(plan.contentHash)}</p>
            {plan.txHash ? <p className="hash">Transaction {shortHash(plan.txHash)}</p> : null}
          </article>
          <article className="card">
            <h2>Actions</h2>
            {plan.actions.map((action) => (
              <div className="action" key={action.title}>
                <span className={`pill ${action.priority}`}>{action.priority}</span>
                <div>
                  <h3>{action.title}</h3>
                  <p className="note">{action.detail}</p>
                </div>
              </div>
            ))}
          </article>
          <article className="card">
            <h2>Assumptions</h2>
            <ul className="clean">
              {plan.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
            <p>{plan.disclaimer}</p>
          </article>
        </>
      )}
    </section>
  );
}
