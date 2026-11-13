import { expect } from "chai";
import { ethers } from "hardhat";

describe("PlatformRegistry", () => {
  async function deploy() {
    const factory = await ethers.getContractFactory("PlatformRegistry");
    const registry = await factory.deploy();
    await registry.waitForDeployment();
    return registry;
  }

  it("registers a wallet, records consent, and appends attestations", async () => {
    const [owner] = await ethers.getSigners();
    const registry = await deploy();
    const scope = ethers.id("PLANNING_DATA");
    const recordType = ethers.id("PLAN");
    const firstHash = ethers.id("snapshot-one");
    const secondHash = ethers.id("snapshot-two");

    await registry.register();
    expect(await registry.registered(owner.address)).to.equal(true);
    await registry.register();

    await registry.setConsent(scope, true);
    expect(await registry.consent(owner.address, scope)).to.equal(true);
    await registry.setConsent(scope, false);
    expect(await registry.consent(owner.address, scope)).to.equal(false);

    await expect(registry.attest(firstHash, recordType))
      .to.emit(registry, "Attested")
      .withArgs(0n, owner.address, firstHash, recordType);
    await registry.attest(secondHash, recordType);

    expect(await registry.recordCount()).to.equal(2n);
    const first = await registry.getRecord(0);
    const second = await registry.getRecord(1);
    expect(first.subject).to.equal(owner.address);
    expect(first.contentHash).to.equal(firstHash);
    expect(second.contentHash).to.equal(secondHash);
  });

  it("rejects empty hashes and unregistered callers", async () => {
    const registry = await deploy();
    const recordType = ethers.id("PLAN");
    const hash = ethers.id("payload");

    await expect(registry.attest(hash, recordType)).to.be.revertedWithCustomError(registry, "NotRegistered");
    await expect(registry.setConsent(ethers.id("PLANNING_DATA"), true)).to.be.revertedWithCustomError(
      registry,
      "NotRegistered",
    );

    await registry.register();
    await expect(registry.attest(ethers.ZeroHash, recordType)).to.be.revertedWithCustomError(registry, "EmptyHash");
    await expect(registry.attest(hash, ethers.ZeroHash)).to.be.revertedWithCustomError(registry, "EmptyHash");
    await expect(registry.setConsent(ethers.ZeroHash, true)).to.be.revertedWithCustomError(registry, "EmptyHash");
  });
});
