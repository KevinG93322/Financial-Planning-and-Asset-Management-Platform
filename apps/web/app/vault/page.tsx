"use client";

import { assetAbi, vaultAbi } from "@fp/shared";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { api } from "../../lib/api";
import type { ChainConfig } from "../../lib/types";
import { getActiveSigner } from "../../lib/wallet";

type Position = {
  wallet: bigint;
  shares: bigint;
  assets: bigint;
  claimed: boolean;
};

type ReceiptRow = { txHash: string; action: string; blockNumber: string };

function formatToken(value: bigint): string {
  const [whole, fraction = ""] = formatUnits(value, 18).split(".");
  return `${whole}.${fraction.slice(0, 2).padEnd(2, "0")}`;
}

function shortHash(value: string): string {
  return value.length < 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export default function VaultPage() {
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<ChainConfig | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [amount, setAmount] = useState("1000");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(current = config) {
    if (!current?.deployed || !user) return;
    const signer = await getActiveSigner();
    const address = await signer.getAddress();
    const provider = signer.provider;
    if (!provider) throw new Error("Wallet provider is missing");
    const asset = new Contract(current.asset, assetAbi, provider);
    const vault = new Contract(current.vault, vaultAbi, provider);
    const [wallet, shares, claimed] = await Promise.all([
      asset.balanceOf(address) as Promise<bigint>,
      vault.balanceOf(address) as Promise<bigint>,
      asset.claimed(address) as Promise<boolean>,
    ]);
    const assets = (await vault.convertToAssets(shares)) as bigint;
    setPosition({ wallet, shares, assets, claimed });
    const history = await api<{ receipts: ReceiptRow[] }>("/chain/vault/receipts");
    setReceipts(history.receipts);
  }

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    void (async () => {
      try {
        const chain = await api<ChainConfig>("/chain/config");
        if (cancel) return;
        setConfig(chain);
        if (chain.deployed) await refresh(chain);
      } catch (caught) {
        if (!cancel) setError(caught instanceof Error ? caught.message : "Could not reach the vault");
      }
    })();
    return () => {
      cancel = true;
    };
    // refresh closes over the latest signer mode; the user session is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function confirm(txHash: string, action: ReceiptRow["action"]) {
    await api("/chain/vault/confirm", {
      method: "POST",
      body: JSON.stringify({ txHash, action }),
    });
  }

  async function claim() {
    if (!config) return;
    setBusy(true);
    setError("");
    try {
      const signer = await getActiveSigner();
      const asset = new Contract(config.asset, assetAbi, signer);
      setStatus("Claiming demo tokens");
      const tx = await asset.faucet();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Faucet transaction was not mined");
      await confirm(receipt.hash, "faucet");
      await refresh(config);
      setStatus("Faucet claim confirmed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Faucet failed");
    } finally {
      setBusy(false);
    }
  }

  async function deposit() {
    if (!config || !user) return;
    setBusy(true);
    setError("");
    try {
      const assets = parseUnits(amount.trim(), 18);
      const signer = await getActiveSigner();
      const address = await signer.getAddress();
      const asset = new Contract(config.asset, assetAbi, signer);
      const vault = new Contract(config.vault, vaultAbi, signer);
      const allowance = (await asset.allowance(address, config.vault)) as bigint;
      if (allowance < assets) {
        setStatus("Approving the vault");
        const approval = await asset.approve(config.vault, assets);
        const approvalReceipt = await approval.wait();
        if (!approvalReceipt) throw new Error("Approval was not mined");
        await confirm(approvalReceipt.hash, "approve");
      }
      setStatus("Depositing into the vault");
      const tx = await vault.deposit(assets, address);
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Deposit was not mined");
      await confirm(receipt.hash, "deposit");
      await refresh(config);
      setStatus("Deposit confirmed. Shares are read from the vault.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!config || !user) return;
    setBusy(true);
    setError("");
    try {
      const assets = parseUnits(amount.trim(), 18);
      const signer = await getActiveSigner();
      const address = await signer.getAddress();
      const vault = new Contract(config.vault, vaultAbi, signer);
      setStatus("Withdrawing from the vault");
      const tx = await vault.withdraw(assets, address, address);
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Withdrawal was not mined");
      await confirm(receipt.hash, "withdraw");
      await refresh(config);
      setStatus("Withdrawal confirmed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="note">Loading vault…</p>;
  if (!user) return <p className="note">Sign in from the home page to use the demo vault.</p>;

  return (
    <section className="stack">
      <div>
        <p className="kicker">Vault</p>
        <h1>Demo ERC-4626 shares</h1>
        <p className="intro">
          Demo tokens have no monetary value. Claim the faucet, deposit DEMO into the planning vault, and withdraw the
          same asset. Positions are read from <span className="mono">balanceOf</span> and{" "}
          <span className="mono">convertToAssets</span>.
        </p>
      </div>
      {error ? <p className="alert">{error}</p> : null}
      {status ? <p className="note">{status}</p> : null}
      {!config?.deployed ? (
        <div className="card">
          <h2>Contracts are not deployed</h2>
          <p className="note">Start the Hardhat node and run the deploy script. The vault address is read from the API.</p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <article className="card stat">
              <span>Wallet DEMO</span>
              <strong>{position ? formatToken(position.wallet) : "…"}</strong>
            </article>
            <article className="card stat">
              <span>Vault shares</span>
              <strong>{position ? formatToken(position.shares) : "…"}</strong>
            </article>
            <article className="card stat">
              <span>Assets in vault</span>
              <strong>{position ? formatToken(position.assets) : "…"}</strong>
            </article>
          </div>
          <div className="card stack">
            <label>
              Amount (DEMO)
              <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
            </label>
            <div className="actions">
              <button type="button" disabled={busy || position?.claimed} onClick={() => void claim()}>
                {position?.claimed ? "Faucet already claimed" : "Claim demo tokens"}
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => void deposit()}>
                Deposit
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => void withdraw()}>
                Withdraw
              </button>
            </div>
            <p className="hash">Vault {config.vault}</p>
          </div>
          {receipts.length > 0 ? (
            <div className="card">
              <h2>Confirmed receipts</h2>
              <ul className="clean">
                {receipts.map((receipt) => (
                  <li key={receipt.txHash}>
                    {receipt.action} · {shortHash(receipt.txHash)} · block {receipt.blockNumber}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
