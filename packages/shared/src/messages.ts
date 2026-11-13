import { getAddress } from "ethers";

export function buildLoginMessage(address: string, nonce: string, issuedAt: string): string {
  const checksum = getAddress(address);
  return [
    "Financial Platform sign-in",
    "",
    "This signature creates a local demo session. It does not approve a transaction.",
    `Address: ${checksum}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
