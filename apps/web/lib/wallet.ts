import {
  HARDHAT_DEMO_PRIVATE_KEY,
  LOCAL_CHAIN_ID,
  assertLocalDemo,
} from "@fp/shared";
import { BrowserProvider, JsonRpcProvider, Wallet, type Signer } from "ethers";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? LOCAL_CHAIN_ID);
const DEMO_KEY = process.env.NEXT_PUBLIC_DEMO_PRIVATE_KEY ?? HARDHAT_DEMO_PRIVATE_KEY;

export type SignerMode = "injected" | "demo";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export function setSignerMode(mode: SignerMode) {
  sessionStorage.setItem("fp.signerMode", mode);
}

export function getSignerMode(): SignerMode | null {
  const value = sessionStorage.getItem("fp.signerMode");
  return value === "injected" || value === "demo" ? value : null;
}

export function demoSigner(): Wallet {
  assertLocalDemo(CHAIN_ID, RPC_URL);
  return new Wallet(DEMO_KEY, new JsonRpcProvider(RPC_URL));
}

export async function injectedSigner(): Promise<Signer> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Use the Hardhat account on this local demo.");
  }
  const hexChainId = `0x${LOCAL_CHAIN_ID.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChainId,
          chainName: "Hardhat Local",
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        },
      ],
    });
  }
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== LOCAL_CHAIN_ID) {
    throw new Error("Switch the wallet to Hardhat local chain 31337.");
  }
  return signer;
}

export async function getActiveSigner(): Promise<Signer> {
  const mode = getSignerMode();
  if (mode === "demo") return demoSigner();
  if (mode === "injected") return injectedSigner();
  throw new Error("Choose a wallet on the sign-in page.");
}
