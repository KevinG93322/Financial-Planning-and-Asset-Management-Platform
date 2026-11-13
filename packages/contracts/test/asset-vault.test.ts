import { expect } from "chai";
import { ethers } from "hardhat";

describe("Demo asset and planning vault", () => {
  async function deploy() {
    const assetFactory = await ethers.getContractFactory("DemoAsset");
    const asset = await assetFactory.deploy();
    await asset.waitForDeployment();
    const vaultFactory = await ethers.getContractFactory("PlanningVault");
    const vault = await vaultFactory.deploy(await asset.getAddress());
    await vault.waitForDeployment();
    return { asset, vault };
  }

  it("caps the faucet at one claim per address", async () => {
    const [owner, other] = await ethers.getSigners();
    const { asset } = await deploy();
    const amount = await asset.FAUCET_AMOUNT();

    await asset.faucet();
    expect(await asset.balanceOf(owner.address)).to.equal(amount);
    await expect(asset.faucet()).to.be.revertedWithCustomError(asset, "AlreadyClaimed");

    await asset.connect(other).faucet();
    expect(await asset.balanceOf(other.address)).to.equal(amount);
  });

  it("accounts for ERC-4626 deposits and withdrawals", async () => {
    const [owner] = await ethers.getSigners();
    const { asset, vault } = await deploy();
    const assets = ethers.parseEther("2500");
    const half = ethers.parseEther("1000");

    await asset.faucet();
    await asset.approve(await vault.getAddress(), assets);
    const preview = await vault.previewDeposit(assets);

    await expect(vault.deposit(assets, owner.address)).to.emit(vault, "Deposit");
    expect(await vault.balanceOf(owner.address)).to.equal(preview);
    expect(await vault.convertToAssets(preview)).to.equal(assets);

    await vault.withdraw(half, owner.address, owner.address);
    expect(await vault.convertToAssets(await vault.balanceOf(owner.address))).to.equal(assets - half);
    expect(await asset.balanceOf(owner.address)).to.equal((await asset.FAUCET_AMOUNT()) - assets + half);
  });
});
