'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Server,
  Database,
  Activity,
  Calendar,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react'

export default function AnalyticsPage() {
  const { isConnected } = useAccount()
  const router = useRouter()
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
      return
    }
  }, [isConnected, router])

  // Mock analytics data
  const analytics = {
    overview: {
      totalEarnings: 2847.5,
      earningsChange: 12.5,
      activeNodes: 3,
      nodesChange: 1,
      datasetRewards: 456.7,
      datasetChange: -2.1,
      totalJobs: 89,
      jobsChange: 8.3
    },
    earnings: {
      daily: [
        { date: '2024-01-08', compute: 45.2, dataset: 12.1 },
        { date: '2024-01-09', compute: 52.8, dataset: 8.9 },
        { date: '2024-01-10', compute: 38.4, dataset: 15.6 },
        { date: '2024-01-11', compute: 67.1, dataset: 9.2 },
        { date: '2024-01-12', compute: 41.9, dataset: 18.4 },
        { date: '2024-01-13', compute: 59.3, dataset: 11.7 },
        { date: '2024-01-14', compute: 73.6, dataset: 14.3 }
      ]
    },
    nodePerformance: [
      { name: 'Gaming Rig Pro', uptime: 99.2, earnings: 1247.8, jobs: 45 },
      { name: 'Home Server', uptime: 98.1, earnings: 856.3, jobs: 32 },
      { name: 'Cloud Instance', uptime: 97.8, earnings: 743.4, jobs: 12 }
    ],
    jobTypes: [
      { type: 'Image Classification', count: 34, earnings: 892.1 },
      { type: 'NLP Training', count: 28, earnings: 1156.7 },
      { type: 'Time Series', count: 15, earnings: 445.2 },
      { type: 'Recommendation', count: 12, earnings: 353.5 }
    ]
  }

  const StatCard = ({ title, value, change, icon: Icon, format = 'number' }: any) => (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {format === 'currency' ? `${value} $DUCK` : value}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {change > 0 ? (
              <TrendingUp className="w-3 h-3 text-green-600" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600" />
            )}
            <span className={`text-xs ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(change)}% vs last period
            </span>
          </div>
        </div>
        <Icon className="w-8 h-8 text-accent-cyan" />
      </div>
    </div>
  )

  if (!isConnected) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-2">
              Track your earnings, node performance, and network activity
            </p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {['24h', '7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-accent-orange text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Earnings"
            value={analytics.overview.totalEarnings}
            change={analytics.overview.earningsChange}
            icon={DollarSign}
            format="currency"
          />
          <StatCard
            title="Active Nodes"
            value={analytics.overview.activeNodes}
            change={analytics.overview.nodesChange}
            icon={Server}
          />
          <StatCard
            title="Dataset Rewards"
            value={analytics.overview.datasetRewards}
            change={analytics.overview.datasetChange}
            icon={Database}
            format="currency"
          />
          <StatCard
            title="Completed Jobs"
            value={analytics.overview.totalJobs}
            change={analytics.overview.jobsChange}
            icon={Activity}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Earnings Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Daily Earnings</h3>
              <LineChart className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="space-y-4">
              {analytics.earnings.daily.map((day, index) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="text-sm text-gray-600 w-20">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 bg-accent-orange rounded-full"></div>
                      <span className="text-sm">Compute: {day.compute} $DUCK</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-accent-cyan rounded-full"></div>
                      <span className="text-sm">Dataset: {day.dataset} $DUCK</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {(day.compute + day.dataset).toFixed(1)} $DUCK
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Node Performance */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Node Performance</h3>
              <BarChart3 className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="space-y-4">
              {analytics.nodePerformance.map((node, index) => (
                <div key={node.name} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{node.name}</h4>
                    <span className="text-sm text-green-600">{node.uptime}% uptime</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Earnings:</span>
                      <span className="ml-2 font-medium">{node.earnings} $DUCK</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Jobs:</span>
                      <span className="ml-2 font-medium">{node.jobs}</span>
                    </div>
                  </div>
                  
                  {/* Progress bar for earnings */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-accent-orange h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(node.earnings / Math.max(...analytics.nodePerformance.map(n => n.earnings))) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Job Types Distribution */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Job Types</h3>
              <PieChart className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="space-y-3">
              {analytics.jobTypes.map((jobType, index) => (
                <div key={jobType.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ 
                        backgroundColor: ['#ea580c', '#06b6d4', '#10b981', '#f59e0b'][index % 4] 
                      }}
                    ></div>
                    <span className="font-medium text-gray-900">{jobType.type}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{jobType.count} jobs</div>
                    <div className="text-xs text-gray-600">{jobType.earnings} $DUCK</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <Activity className="w-5 h-5 text-gray-500" />
            </div>
            
            <div className="space-y-3">
              {[
                { time: '2 hours ago', action: 'Completed training job #456', reward: '+25.5 $DUCK' },
                { time: '4 hours ago', action: 'Dataset "Medical Images" used', reward: '+12.1 $DUCK' },
                { time: '6 hours ago', action: 'Node "Gaming Rig Pro" came online', reward: null },
                { time: '8 hours ago', action: 'Completed training job #455', reward: '+18.7 $DUCK' },
                { time: '12 hours ago', action: 'Dataset "Financial Data" used', reward: '+8.9 $DUCK' },
                { time: '1 day ago', action: 'Node maintenance completed', reward: null }
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                  {activity.reward && (
                    <span className="text-sm font-medium text-green-600">{activity.reward}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}