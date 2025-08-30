import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const duckTokenAddress = process.env.DUCK_TOKEN_ADDRESS;
  if (!duckTokenAddress) throw new Error("DUCK_TOKEN_ADDRESS missing");

  const Compute = await ethers.getContractFactory("ComputeMarketplace");
  const Training = await ethers.getContractFactory("TrainingPool");
  const Inference = await ethers.getContractFactory("InferencePool");

  const compute = await Compute.deploy(duckTokenAddress);
  await compute.waitForDeployment();

  const training = await Training.deploy(duckTokenAddress);
  await training.waitForDeployment();

  const inference = await Inference.deploy(duckTokenAddress);
  await inference.waitForDeployment();

  const addresses = {
    network: (await compute.runner!.provider!.getNetwork()).name,
    chainId: Number((await compute.runner!.provider!.getNetwork()).chainId),
    DUCK: duckTokenAddress,
    ComputeMarketplace: await compute.getAddress(),
    TrainingPool: await training.getAddress(),
    InferencePool: await inference.getAddress(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const abiDir = path.join(__dirname, "..", "abi");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.mkdirSync(abiDir, { recursive: true });

  fs.writeFileSync(path.join(deploymentsDir, "duckchain.json"), JSON.stringify(addresses, null, 2));

  // Save ABIs
  const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
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

  console.log("Deployed:", addresses);
}

main().catch((e) => { console.error(e); process.exit(1); });
