import { ethers } from "hardhat";
import { ethers as Ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [a0, a1, a2] = await ethers.getSigners();

  // 1) Deploy Mock DUCK token and faucet some balances
  const Duck = await ethers.getContractFactory("MockDuckToken");
  const duck = await Duck.deploy();
  await duck.waitForDeployment();
  const DUCK = await duck.getAddress();

  const amt = Ethers.parseUnits("1000000", 18);
  await (await duck.mint(a0.address, amt)).wait();
  await (await duck.mint(a1.address, amt)).wait();
  await (await duck.mint(a2.address, amt)).wait();

  // 2) Deploy core contracts
  const Compute = await ethers.getContractFactory("ComputeMarketplace");
  const Training = await ethers.getContractFactory("TrainingPool");
  const Inference = await ethers.getContractFactory("InferencePool");

  const compute = await Compute.deploy(DUCK);
  await compute.waitForDeployment();

  const training = await Training.deploy(DUCK);
  await training.waitForDeployment();

  const inference = await Inference.deploy(DUCK);
  await inference.waitForDeployment();

  const provider = compute.runner!.provider!;
  const net = await provider.getNetwork();

  const addresses = {
    network: net.name,
    chainId: Number(net.chainId),
    DUCK,
    ComputeMarketplace: await compute.getAddress(),
    TrainingPool: await training.getAddress(),
    InferencePool: await inference.getAddress(),
  };

  const rootDir = path.join(__dirname, "..");
  const deploymentsDir = path.join(rootDir, "deployments");
  const abiDir = path.join(rootDir, "abi");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.mkdirSync(abiDir, { recursive: true });

  fs.writeFileSync(
    path.join(deploymentsDir, "duckchain.json"),
    JSON.stringify(addresses, null, 2)
  );

  // 3) Save ABIs (server mounts ./contracts/abi into the container)
  const artifactsDir = path.join(rootDir, "artifacts", "contracts");
  const toCopy = [
    { name: "ComputeMarketplace", file: "ComputeMarketplace.sol/ComputeMarketplace.json" },
    { name: "TrainingPool", file: "TrainingPool.sol/TrainingPool.json" },
    { name: "InferencePool", file: "InferencePool.sol/InferencePool.json" },
  ];
  for (const a of toCopy) {
    const full = path.join(artifactsDir, a.file);
    const artifact = JSON.parse(fs.readFileSync(full, "utf-8"));
    fs.writeFileSync(path.join(abiDir, `${a.name}.json`), JSON.stringify(artifact.abi, null, 2));
  }
  // Also write DUCK ABI expected by the server as DUCK.json
  const duckArtifactPath = path.join(artifactsDir, "MockDuckToken.sol/MockDuckToken.json");
  const duckArtifact = JSON.parse(fs.readFileSync(duckArtifactPath, "utf-8"));
  fs.writeFileSync(path.join(abiDir, `DUCK.json`), JSON.stringify(duckArtifact.abi, null, 2));

  console.log("Deployed:", addresses);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
