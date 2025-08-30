import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

// Mainnet/Testnet RPCs with fallbacks
const DUCKCHAIN_MAINNET_RPC_URL = process.env.DUCKCHAIN_MAINNET_RPC_URL || process.env.DUCKCHAIN_RPC_URL || "";
const DUCKCHAIN_TESTNET_RPC_URL = process.env.DUCKCHAIN_TESTNET_RPC_URL || process.env.DUCKCHAIN_RPC_URL || "";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const DUCKCHAIN_MAINNET_CHAIN_ID = Number(process.env.DUCKCHAIN_MAINNET_CHAIN_ID || process.env.DUCKCHAIN_CHAIN_ID || 0);
const DUCKCHAIN_TESTNET_CHAIN_ID = Number(process.env.DUCKCHAIN_TESTNET_CHAIN_ID || process.env.DUCKCHAIN_CHAIN_ID || 0);

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    duckchain: {
      url: DUCKCHAIN_MAINNET_RPC_URL,
      chainId: DUCKCHAIN_MAINNET_CHAIN_ID,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    duckchainTestnet: {
      url: DUCKCHAIN_TESTNET_RPC_URL,
      chainId: DUCKCHAIN_TESTNET_CHAIN_ID,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;
