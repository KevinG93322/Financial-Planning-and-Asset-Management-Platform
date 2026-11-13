import { Interface, id } from "ethers";
import { registryAbi } from "@fp/shared";
import { describe, expect, it } from "vitest";
import { assertAttestation, assertSuccessfulCall } from "../src/chain/verify";

const registry = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const subject = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const contentHash = id("canonical-snapshot");
const recordType = id("PLAN");

function attestedReceipt(patch?: {
  status?: number;
  to?: string;
  contentHash?: string;
  logAddress?: string;
}) {
  const iface = new Interface(registryAbi);
  const encoded = iface.encodeEventLog("Attested", [
    1n,
    subject,
    patch?.contentHash ?? contentHash,
    recordType,
  ]);
  return {
    status: patch?.status ?? 1,
    from: subject,
    to: patch?.to ?? registry,
    logs: [
      {
        address: patch?.logAddress ?? registry,
        topics: [...encoded.topics],
        data: encoded.data,
      },
    ],
  };
}

describe("receipt checks", () => {
  it("accepts a registry attestation that matches the snapshot", () => {
    const result = assertAttestation(attestedReceipt(), {
      registry,
      subject: subject.toLowerCase(),
      contentHash,
      recordType,
    });
    expect(result.recordId).toBe("1");
  });

  it("rejects reverted, mistargeted, and mismatched attestations", () => {
    const expected = { registry, subject, contentHash, recordType };
    expect(() => assertAttestation(attestedReceipt({ status: 0 }), expected)).toThrow(/reverted/i);
    expect(() => assertAttestation(attestedReceipt({ to: subject }), expected)).toThrow(/registry/i);
    expect(() => assertAttestation(attestedReceipt({ contentHash: id("other") }), expected)).toThrow(/not found/i);
    expect(() => assertAttestation(attestedReceipt({ logAddress: subject }), expected)).toThrow(/not found/i);
  });

  it("checks the signer and target of a vault call", () => {
    const vault = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const receipt = { status: 1, from: subject, to: vault, logs: [] };
    expect(() => assertSuccessfulCall(receipt, { from: subject, to: vault })).not.toThrow();
    expect(() => assertSuccessfulCall({ ...receipt, status: 0 }, { from: subject, to: vault })).toThrow(/reverted/i);
    expect(() => assertSuccessfulCall(receipt, { from: registry, to: vault })).toThrow(/signer/i);
    expect(() => assertSuccessfulCall(receipt, { from: subject, to: registry })).toThrow(/target/i);
  });
});
