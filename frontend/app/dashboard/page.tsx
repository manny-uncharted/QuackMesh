'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CircularProgress } from '@/components/ui/progress'
import { WalletConnect } from '@/components/wallet-connect'
import { useAppStore } from '@/lib/store'
import { connectNodesWS, connectLogsWS } from '@/lib/realtime'
import { formatNumber, formatTimeAgo } from '@/lib/utils'
import { 
  TrendingUp, 
  Calendar, 
  Gift, 
  Server, 
  Activity, 
  Eye, 
  Square, 
  Play,
  Users,
  Clock,
  Award
} from 'lucide-react'

export default function DashboardPage() {
  const { isConnected } = useAccount()
  const router = useRouter()
  const { 
    userStats, 
    computeNodes, 
    activityFeed, 
    trainingJobs, 
    claimRewards,
    updateNodeStatus,
    handleNodeUpdate,
  } = useAppStore()

  const [logsOpen, setLogsOpen] = useState(false)
  const [activeLogNodeId, setActiveLogNodeId] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [disconnectLogs, setDisconnectLogs] = useState<null | (() => void)>(null)

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
    }
  }, [isConnected, router])

  // Real-time nodes WebSocket
  useEffect(() => {
    if (!isConnected) return
    const disconnect = connectNodesWS(handleNodeUpdate)
    return () => {
      try { disconnect?.() } catch {}
    }
  }, [isConnected, handleNodeUpdate])

  // Logs WebSocket when modal open
  useEffect(() => {
    if (!logsOpen || !activeLogNodeId) return
    const mid = parseInt(activeLogNodeId, 10)
    const stop = connectLogsWS(mid, (entry) => {
      const line = `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.level}: ${entry.message}`
      setLogs((prev) => [...prev, line])
    })
    setDisconnectLogs(() => stop)
    return () => {
      try { stop?.() } catch {}
    }
  }, [logsOpen, activeLogNodeId])

  if (!isConnected) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-50'
      case 'training': return 'text-orange-600 bg-orange-50'
      case 'offline': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      case 'training': return <div className="w-2 h-2 bg-orange-500 rounded-full animate-spin" />
      case 'offline': return <div className="w-2 h-2 bg-red-500 rounded-full" />
      default: return <div className="w-2 h-2 bg-gray-500 rounded-full" />
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'reward': return <Gift className="w-4 h-4 text-green-600" />
      case 'node': return <Server className="w-4 h-4 text-blue-600" />
      case 'job': return <Activity className="w-4 h-4 text-orange-600" />
      default: return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Earnings Summary */}
        <motion.div 
          className="grid md:grid-cols-4 gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="md:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Total Earnings</h2>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {formatNumber(userStats.totalEarned)} $DUCK
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                This week: {formatNumber(userStats.weeklyEarned)} $DUCK
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Pending Rewards</h3>
              <Gift className="w-5 h-5 text-accent-orange" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-4">
              {formatNumber(userStats.pendingRewards)} $DUCK
            </div>
            <Button 
              onClick={claimRewards}
              className="w-full"
              disabled={userStats.pendingRewards === 0}
            >
              Claim Rewards
            </Button>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Active Nodes</h3>
              <Server className="w-5 h-5 text-accent-cyan" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {userStats.activeNodes}
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {computeNodes.filter(n => n.status === 'training').length} training
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Compute Instances */}
          <motion.div 
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">My Active Nodes</h2>
                <Button variant="outline" size="sm">
                  Add Node
                </Button>
              </div>
              
              <div className="space-y-4">
                {computeNodes.map((node) => (
                  <div key={node.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(node.status)}
                          <span className="font-medium text-gray-900">{node.name}</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(node.status)}`}>
                          {node.status}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {node.earningsRate} $DUCK/hr
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <CircularProgress value={node.cpu} size={50} />
                        <div className="text-xs text-gray-600 mt-1">CPU</div>
                      </div>
                      <div className="text-center">
                        <CircularProgress 
                          value={node.gpu} 
                          size={50} 
                          variant={node.gpu > 0 ? 'success' : 'default'}
                        />
                        <div className="text-xs text-gray-600 mt-1">GPU</div>
                      </div>
                      <div className="text-center">
                        <CircularProgress value={node.ram} size={50} variant="warning" />
                        <div className="text-xs text-gray-600 mt-1">RAM</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => { setActiveLogNodeId(node.id); setLogsOpen(true) }}
                      >
                        <Eye className="w-3 h-3" />
                        View Logs
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => updateNodeStatus(node.id, node.status === 'online' ? 'offline' : 'online')}
                      >
                        {node.status === 'online' ? (
                          <>
                            <Square className="w-3 h-3" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Start
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Activity Feed</h2>
              
              <div className="space-y-3">
                {activityFeed.map((entry) => (
                  <div key={entry.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(entry.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{entry.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Job Marketplace */}
        <motion.div 
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Training Jobs</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainingJobs.map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{job.title}</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {job.modelType}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Reward:</span>
                      <span className="font-medium text-gray-900">{formatNumber(job.totalReward)} $DUCK</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Time Left:</span>
                      <span className="font-medium text-gray-900 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {job.timeLeft}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Participants:</span>
                      <span className="font-medium text-gray-900 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {job.participants}
                      </span>
                    </div>
                  </div>
                  
                  <Button variant="secondary" size="sm" className="w-full">
                    Contribute to this Job
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
    {/* Logs Modal */}
    {logsOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white w-full max-w-3xl rounded-lg shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Node Logs {activeLogNodeId ? `#${activeLogNodeId}` : ''}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try { disconnectLogs?.() } catch {}
                setLogsOpen(false)
                setActiveLogNodeId(null)
                setLogs([])
                setDisconnectLogs(null)
              }}
            >
              Close
            </Button>
          </div>
          <div className="p-4 max-h-[60vh] overflow-auto bg-gray-50">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
{logs.join('\n')}
            </pre>
          </div>
        </div>
      </div>
    )}
    </>
  )
}