import { expect } from "chai";
import { ethers } from "hardhat";

describe("InferencePool", () => {
  it("creates job and pays provider", async () => {
    const [requester, provider] = await ethers.getSigners();

    const Duck = await ethers.getContractFactory("MockDuckToken");
    const duck = await Duck.deploy();
    await duck.waitForDeployment();

    const IP = await ethers.getContractFactory("InferencePool");
    const ip = await IP.deploy(await duck.getAddress());
    await ip.waitForDeployment();

    await duck.mint(await requester.getAddress(), ethers.parseEther("20"));
    await duck.connect(requester).approve(await ip.getAddress(), ethers.parseEther("20"));

    await (await ip.connect(requester).createInferenceJob(ethers.parseEther("20"))).wait();

    await expect(ip.connect(requester).payProvider(1, await provider.getAddress(), ethers.parseEther("5")))
      .to.emit(ip, "InferencePaid");

    const bal = await duck.balanceOf(await provider.getAddress());
    expect(bal).to.equal(ethers.parseEther("5"));
  });
});
