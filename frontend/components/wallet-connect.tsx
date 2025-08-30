'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { formatAddress } from '@/lib/utils'
import { Wallet, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'

interface WalletConnectProps {
  onConnect?: () => void
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export function WalletConnect({ onConnect, variant = 'primary', size = 'md' }: WalletConnectProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const handleConnect = () => {
    const injectedConnector = connectors.find(connector => connector.id === 'injected')
    if (injectedConnector) {
      connect({ connector: injectedConnector })
      onConnect?.()
    }
  }

  if (isConnected && address) {
    return (
      <motion.div 
        className="flex items-center gap-3"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow-md">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-700">
            {formatAddress(address)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
          className="p-2"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </motion.div>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleConnect}
      className="flex items-center gap-2"
    >
      <Wallet className="w-5 h-5" />
      Connect Wallet
    </Button>
  )
}