import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const registry = await ethers.deployContract("PlatformRegistry");
  await registry.waitForDeployment();

  const asset = await ethers.deployContract("DemoAsset");
  await asset.waitForDeployment();

  const vault = await ethers.deployContract("PlanningVault", [await asset.getAddress()]);
  await vault.waitForDeployment();

  const network = await ethers.provider.getNetwork();
  const deployment = {
    chainId: Number(network.chainId),
    registry: await registry.getAddress(),
    asset: await asset.getAddress(),
    vault: await vault.getAddress(),
  };

  const destination = path.resolve(__dirname, "../../../deployments/local.json");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`Wrote ${destination}`);
  console.log(deployment);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
