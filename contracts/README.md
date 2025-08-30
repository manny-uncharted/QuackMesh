# QuackMesh Contracts

Contracts:
- ComputeMarketplace.sol
- TrainingPool.sol
- InferencePool.sol

## Setup
```bash
cd contracts
npm i
cp .env.example .env # fill RPC + key
npm run build
npm run deploy
```

After deployment, addresses and ABIs are saved under `contracts/deployments/duckchain.json` and `contracts/abi/`.
