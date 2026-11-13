import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZERO_ADDRESS } from "@fp/shared";

export type Deployment = {
  chainId: number;
  registry: string;
  asset: string;
  vault: string;
};

const deploymentFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../deployments/local.json",
);

export function readDeployment(): Deployment {
  if (!existsSync(deploymentFile)) {
    throw new Error("Deploy the local contracts before using chain features.");
  }
  return JSON.parse(readFileSync(deploymentFile, "utf8")) as Deployment;
}

export function isDeployed(deployment: Deployment): boolean {
  return [deployment.registry, deployment.asset, deployment.vault].every(
    (address) => typeof address === "string" && address.toLowerCase() !== ZERO_ADDRESS,
  );
}
