'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { formatNumber } from '@/lib/utils'
import { TrendingUp, Zap, Users } from 'lucide-react'

export function LiveStats() {
  const { networkStats, updateNetworkStats } = useAppStore()

  useEffect(() => {
    const interval = setInterval(() => {
      updateNetworkStats()
    }, 3000)

    return () => clearInterval(interval)
  }, [updateNetworkStats])

  const stats = [
    {
      label: 'Total $DUCK Earned',
      value: networkStats.totalDuckEarned,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Active Training Jobs',
      value: networkStats.activeJobs,
      icon: Zap,
      color: 'text-accent-orange',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Online Compute Nodes',
      value: networkStats.onlineNodes,
      icon: Users,
      color: 'text-accent-cyan',
      bgColor: 'bg-cyan-50',
    },
  ]

  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 z-10"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 1 }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-white shadow-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 1.2 + index * 0.1 }}
            >
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className="text-sm text-gray-600">{stat.label}</div>
                <motion.div 
                  className="text-lg font-bold text-gray-900"
                  key={stat.value}
                  initial={{ scale: 1.2, color: stat.color.replace('text-', '#') }}
                  animate={{ scale: 1, color: '#111827' }}
                  transition={{ duration: 0.3 }}
                >
                  {formatNumber(stat.value)}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}