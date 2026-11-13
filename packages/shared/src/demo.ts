import { LOCAL_CHAIN_ID } from "./constants.js";

/** The published Hardhat demo key may sign only against a loopback chain 31337 RPC. */
export function assertLocalDemo(chainId: number, rpcUrl: string): void {
  let hostname = "";
  try {
    hostname = new URL(rpcUrl).hostname;
  } catch {
    throw new Error("The Hardhat demo account needs a local RPC URL.");
  }
  const loopback = hostname === "127.0.0.1" || hostname === "localhost";
  if (chainId !== LOCAL_CHAIN_ID || !loopback) {
    throw new Error("The Hardhat demo account is only available for local chain 31337.");
  }
}
