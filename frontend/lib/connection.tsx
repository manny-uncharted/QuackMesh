"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiBase } from './api'

export interface ConnectionState {
  isBackendAlive: boolean
  isReady: boolean
  isBlockchainAlive: boolean
  isHuggingFaceReachable: boolean
  lastCheckedAt?: number
  mode: 'live' | 'demo'
  refresh: () => Promise<void>
}

const ConnectionContext = createContext<ConnectionState | null>(null)

function serverBaseFromApiBase(base: string): string {
  try {
    if (base.endsWith('/api')) return base.slice(0, -4) || '/'
    return base || '/'
  } catch {
    return '/'
  }
}

async function checkBackend(base: string): Promise<{ liveness: boolean; readiness: boolean }> {
  const serverBase = serverBaseFromApiBase(base)
  try {
    const [l, r] = await Promise.allSettled([
      fetch(`${serverBase}/healthz`, { cache: 'no-store' }),
      fetch(`${serverBase}/readyz`, { cache: 'no-store' }),
    ])
    const liveness = l.status === 'fulfilled' && l.value.ok
    const readiness = r.status === 'fulfilled' && r.value.ok
    return { liveness, readiness }
  } catch {
    return { liveness: false, readiness: false }
  }
}

async function checkBlockchain(): Promise<boolean> {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'
  try {
    const r = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    })
    if (!r.ok) return false
    const j = await r.json()
    return typeof j?.result === 'string' && j.result.startsWith('0x')
  } catch {
    return false
  }
}

async function checkHuggingFace(): Promise<boolean> {
  try {
    const r = await fetch('https://huggingface.co/api/models/distilbert-base-uncased', { cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isBackendAlive, setBackendAlive] = useState(false)
  const [isReady, setReady] = useState(false)
  const [isBlockchainAlive, setChainAlive] = useState(false)
  const [isHuggingFaceReachable, setHF] = useState(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | undefined>(undefined)

  const refresh = async () => {
    const [{ liveness, readiness }, chain, hf] = await Promise.all([
      checkBackend(apiBase),
      checkBlockchain(),
      checkHuggingFace(),
    ])
    setBackendAlive(liveness)
    setReady(readiness)
    setChainAlive(chain)
    setHF(hf)
    setLastCheckedAt(Date.now())
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [])

  const mode: 'live' | 'demo' = useMemo(() => {
    // Treat as live only when backend and blockchain are up
    return isBackendAlive && isBlockchainAlive ? 'live' : 'demo'
  }, [isBackendAlive, isBlockchainAlive])

  const value: ConnectionState = {
    isBackendAlive,
    isReady,
    isBlockchainAlive,
    isHuggingFaceReachable,
    lastCheckedAt,
    mode,
    refresh,
  }

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

export function useConnection(): ConnectionState {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider')
  return ctx
}
