'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CircularProgress } from '@/components/ui/progress'
import { 
  Server, 
  Activity, 
  Eye, 
  Square, 
  Play,
  RefreshCw,
  Trash2,
  Plus,
  Wifi,
  WifiOff,
  Loader,
  AlertTriangle,
  CheckCircle,
  TrendingUp
} from 'lucide-react'
import { apiBase, authHeaders } from '@/lib/api'

interface NodeStatus {
  machine_id: number
  name: string
  provider_address: string
  endpoint: string
  specs: {
    cpu: number
    gpu: number
    ram_gb: number
  }
  status: 'online' | 'offline' | 'training' | 'error'
  last_seen: string
  usage: {
    cpu_percent: number
    memory_percent: number
    gpu_percent?: number
  }
  earnings: {
    hourly_rate: number
    total_earned: number
    active_rental: boolean
  }
}

export default function NodesPage() {
  const { isConnected, address } = useAccount()
  const router = useRouter()
  const [nodes, setNodes] = useState<NodeStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [control, setControl] = useState<Record<number, { pending: boolean; ok?: boolean; message?: string }>>({})

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
      return
    }
    
    let cancelled = false
    const load = async () => {
      try {
        const url = `${apiBase}/nodes/${address ? `?user_address=${encodeURIComponent(address)}` : ''}`
        const r = await fetch(url, { headers: authHeaders(), cache: 'no-store' })
        if (!r.ok) throw new Error(`Failed to load nodes: ${r.status}`)
        const data = await r.json()
        const mapped: NodeStatus[] = (Array.isArray(data) ? data : []).map((n: any) => ({
          machine_id: n.machine_id,
          name: n.name || `Node-${n.machine_id}`,
          provider_address: n.provider_address || '',
          endpoint: n.endpoint || '',
          specs: {
            cpu: n.specs?.cpu ?? n.specs?.cpu_cores ?? 0,
            gpu: n.specs?.gpu ?? n.specs?.gpu_count ?? 0,
            ram_gb: n.specs?.ram_gb ?? (n.specs?.ram_bytes ? Math.round(n.specs.ram_bytes / (1024 ** 3)) : 0),
          },
          status: (['online', 'offline', 'training', 'error'].includes(n.status) ? n.status : 'offline') as any,
          last_seen: n.last_seen || '',
          usage: {
            cpu_percent: n.usage?.cpu_percent ?? 0,
            memory_percent: n.usage?.memory_percent ?? 0,
            gpu_percent: n.usage?.gpu_percent ?? 0,
          },
          earnings: { hourly_rate: 0, total_earned: 0, active_rental: false },
        }))
        if (!cancelled) {
          setNodes(mapped)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [isConnected, address, router])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'training':
        return <Loader className="w-5 h-5 text-orange-600 animate-spin" />
      case 'offline':
        return <WifiOff className="w-5 h-5 text-red-600" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      default:
        return <Server className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800'
      case 'training': return 'bg-orange-100 text-orange-800'
      case 'offline': return 'bg-red-100 text-red-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleNodeAction = async (nodeId: number, action: string) => {
    try {
      setControl(prev => ({ ...prev, [nodeId]: { pending: true } }))
      const body = { action: action === 'delete' ? 'terminate' : action }
      const r = await fetch(`${apiBase}/nodes/${encodeURIComponent(nodeId)}/control`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      const txt = await r.text()
      let json: any = undefined
      try { json = txt ? JSON.parse(txt) : undefined } catch {}
      const reachable = json?.result?.reachable
      const ok = r.ok && (reachable !== false)
      // Optimistic status flip for start/stop
      if (ok) {
        setNodes(prev => prev.map(n => {
          if (n.machine_id !== nodeId) return n
          if (action === 'start' && reachable === true) return { ...n, status: 'online' }
          if (action === 'stop') return { ...n, status: 'offline' }
          return n
        }))
      }
      setControl(prev => ({
        ...prev,
        [nodeId]: {
          pending: false,
          ok,
          message: ok ? 'Command sent' : `Failed${json?.result?.error ? `: ${json.result.error}` : ''}`,
        },
      }))
    } catch (e: any) {
      setControl(prev => ({ ...prev, [nodeId]: { pending: false, ok: false, message: e?.message || 'Error' } }))
    }
  }

  const viewNodeLogs = async (nodeId: number) => {
    setSelectedNode(nodeId)
    setShowLogs(true)
    try {
      const r = await fetch(`${apiBase}/nodes/${encodeURIComponent(nodeId)}/logs?limit=200`, {
        headers: authHeaders(),
        cache: 'no-store',
      })
      if (!r.ok) {
        setLogs([`Failed to fetch logs: ${r.status}`])
        return
      }
      const data = await r.json()
      const lines: string[] = (data?.logs || []).map((l: any) => {
        const ts = l.timestamp ? new Date(l.timestamp).toISOString() : ''
        const lvl = l.level || 'INFO'
        const msg = l.message || ''
        return `[${ts}] ${lvl}: ${msg}`
      })
      setLogs(lines)
    } catch (e) {
      setLogs([`Error loading logs`])
    }
  }

  if (!isConnected) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Compute Nodes</h1>
            <p className="text-gray-600 mt-2">
              Monitor and manage your registered compute nodes
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => router.push('/register-node')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Node
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Nodes</p>
                <p className="text-2xl font-bold text-gray-900">{nodes.length}</p>
              </div>
              <Server className="w-8 h-8 text-accent-cyan" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Online</p>
                <p className="text-2xl font-bold text-green-600">
                  {nodes.filter(n => n.status === 'online' || n.status === 'training').length}
                </p>
              </div>
              <Wifi className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Training</p>
                <p className="text-2xl font-bold text-orange-600">
                  {nodes.filter(n => n.status === 'training').length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-accent-orange">
                  {nodes.reduce((sum, n) => sum + n.earnings.total_earned, 0).toFixed(1)} $DUCK
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent-orange" />
            </div>
          </div>
        </div>

        {/* Nodes Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-accent-orange" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {nodes.map((node) => (
              <motion.div
                key={node.machine_id}
                className="card hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(node.status)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{node.name}</h3>
                      <p className="text-sm text-gray-600">ID: {node.machine_id}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(node.status)}`}>
                    {node.status}
                  </span>
                </div>

                {/* Node Specs */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <CircularProgress value={node.usage.cpu_percent} size={60} />
                    <div className="text-xs text-gray-600 mt-1">
                      CPU ({node.specs.cpu} cores)
                    </div>
                  </div>
                  <div className="text-center">
                    <CircularProgress 
                      value={node.usage.gpu_percent || 0} 
                      size={60} 
                      variant={node.specs.gpu > 0 ? 'success' : 'default'}
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      GPU ({node.specs.gpu})
                    </div>
                  </div>
                  <div className="text-center">
                    <CircularProgress value={node.usage.memory_percent} size={60} variant="warning" />
                    <div className="text-xs text-gray-600 mt-1">
                      RAM ({node.specs.ram_gb}GB)
                    </div>
                  </div>
                </div>

                {/* Earnings Info */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Hourly Rate</p>
                      <p className="font-semibold text-gray-900">{node.earnings.hourly_rate} $DUCK/hr</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total Earned</p>
                      <p className="font-semibold text-gray-900">{node.earnings.total_earned} $DUCK</p>
                    </div>
                  </div>
                  {node.earnings.active_rental && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600 font-medium">Currently Rented</span>
                    </div>
                  )}
                </div>

                {/* Node Actions */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => viewNodeLogs(node.machine_id)}
                      className="flex-1"
                      disabled={!!control[node.machine_id]?.pending}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Logs
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNodeAction(node.machine_id, 'restart')}
                      disabled={!!control[node.machine_id]?.pending}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNodeAction(node.machine_id, node.status === 'online' ? 'stop' : 'start')}
                      disabled={!!control[node.machine_id]?.pending}
                    >
                      {node.status === 'online' ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleNodeAction(node.machine_id, 'delete')}
                      className="text-red-600 hover:text-red-700"
                      disabled={!!control[node.machine_id]?.pending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {control[node.machine_id] && (
                    <div className={`text-xs ${control[node.machine_id].pending ? 'text-gray-600' : control[node.machine_id].ok ? 'text-green-600' : 'text-red-600'}`}>
                      {control[node.machine_id].pending ? 'Sending command…' : (control[node.machine_id].message || (control[node.machine_id].ok ? 'OK' : 'Failed'))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Logs Modal */}
        {showLogs && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold">
                  Node {selectedNode} Logs
                </h3>
                <Button variant="outline" onClick={() => setShowLogs(false)}>
                  Close
                </Button>
              </div>
              <div className="p-6">
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}