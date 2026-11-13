import { Interface, getAddress } from "ethers";
import { registryAbi } from "@fp/shared";

export type TxReceipt = {
  status?: number | bigint | null;
  from?: string | null;
  to?: string | null;
  blockNumber?: number | bigint | null;
  logs: { address: string; topics: readonly string[]; data: string }[];
};

function sameAddress(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

export function assertAttestation(
  receipt: TxReceipt,
  expected: { registry: string; subject: string; contentHash: string; recordType: string },
): { recordId: string } {
  if (Number(receipt.status) !== 1) {
    throw new Error("Transaction reverted");
  }
  if (!receipt.to || !sameAddress(receipt.to, expected.registry)) {
    throw new Error("Transaction was not sent to the registry");
  }

  const iface = new Interface(registryAbi);
  const matches: string[] = [];
  for (const log of receipt.logs) {
    if (!sameAddress(log.address, expected.registry)) continue;
    let parsed: ReturnType<Interface["parseLog"]> | null = null;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.name !== "Attested") continue;
    const subject = String(parsed.args.subject);
    const contentHash = String(parsed.args.contentHash);
    const recordType = String(parsed.args.recordType);
    if (
      sameAddress(subject, expected.subject) &&
      contentHash.toLowerCase() === expected.contentHash.toLowerCase() &&
      recordType.toLowerCase() === expected.recordType.toLowerCase()
    ) {
      matches.push(String(parsed.args.id));
    }
  }

  if (matches.length !== 1) {
    throw new Error("Matching attestation was not found in the receipt");
  }
  return { recordId: matches[0] };
}

export function assertSuccessfulCall(receipt: TxReceipt, expected: { from: string; to: string }): void {
  if (Number(receipt.status) !== 1) {
    throw new Error("Transaction reverted");
  }
  if (!receipt.from || !sameAddress(receipt.from, expected.from)) {
    throw new Error("Transaction signer does not match the session");
  }
  if (!receipt.to || !sameAddress(receipt.to, expected.to)) {
    throw new Error("Transaction target does not match the action");
  }
}
