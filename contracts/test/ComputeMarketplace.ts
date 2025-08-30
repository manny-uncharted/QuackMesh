import { expect } from "chai";
import { ethers } from "hardhat";

describe("ComputeMarketplace", function () {
  it("lists and rents a machine", async () => {
    const [provider, renter] = await ethers.getSigners();

    const Duck = await ethers.getContractFactory("MockDuckToken");
    const duck = await Duck.deploy();
    await duck.waitForDeployment();

    const CM = await ethers.getContractFactory("ComputeMarketplace");
    const cm = await CM.deploy(await duck.getAddress());
    await cm.waitForDeployment();

    // Provider lists
    const tx = await cm.connect(provider).listMachine("{cpu:8,gpu:0,ram:32}", ethers.parseEther("1"));
    const receipt = await tx.wait();

    // Renter mints and approves DUCK
    await duck.mint(await renter.getAddress(), ethers.parseEther("10"));
    await duck.connect(renter).approve(await cm.getAddress(), ethers.parseEther("3"));

    // Rent for 3 hours
    await expect(cm.connect(renter).rentMachine(1, 3)).to.emit(cm, "MachineRented");

    // Provider received payment
    const bal = await duck.balanceOf(await provider.getAddress());
    expect(bal).to.equal(ethers.parseEther("3"));
  });
});
