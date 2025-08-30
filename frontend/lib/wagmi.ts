import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// DuckChain testnet configuration
const duckChainTestnet = {
  id: 1337,
  name: 'DuckChain Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'DUCK',
    symbol: 'DUCK',
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
  blockExplorers: {
    default: { name: 'DuckScan', url: 'https://duckscan.example.com' },
  },
} as const

export const config = createConfig({
  chains: [duckChainTestnet, mainnet, sepolia],
  connectors: [
    injected(),
    metaMask(),
    ...(process.env.NEXT_PUBLIC_WC_PROJECT_ID ? [walletConnect({ 
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID 
    })] : []),
  ],
  transports: {
    [duckChainTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})