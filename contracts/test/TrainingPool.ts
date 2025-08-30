import { expect } from "chai";
import { ethers } from "hardhat";

describe("TrainingPool", () => {
  it("creates job and distributes reward on valid proof", async () => {
    const [requester, contributor] = await ethers.getSigners();

    const Duck = await ethers.getContractFactory("MockDuckToken");
    const duck = await Duck.deploy();
    await duck.waitForDeployment();

    const TP = await ethers.getContractFactory("TrainingPool");
    const tp = await TP.deploy(await duck.getAddress());
    await tp.waitForDeployment();

    // Fund requester and approve pool
    await duck.mint(await requester.getAddress(), ethers.parseEther("100"));
    await duck.connect(requester).approve(await tp.getAddress(), ethers.parseEther("50"));

    // Create job
    const jobTx = await tp.connect(requester).createTrainingJob(ethers.id("model"), ethers.parseEther("50"));
    await jobTx.wait();

    // Contributor submits update with 75% accuracy (7500 bps)
    const subTx = await tp.connect(contributor).submitUpdate(1, ethers.id("update1"), 7500);
    await subTx.wait();

    // Requester distributes reward
    await expect(tp.connect(requester).distributeReward(1, 0, ethers.parseEther("10")))
      .to.emit(tp, "RewardDistributed");

    const bal = await duck.balanceOf(await contributor.getAddress());
    expect(bal).to.equal(ethers.parseEther("10"));
  });
});
