import { create } from 'zustand'

interface NetworkStats {
  totalDuckEarned: number
  activeJobs: number
  onlineNodes: number
}

interface UserStats {
  totalEarned: number
  weeklyEarned: number
  activeNodes: number
  pendingRewards: number
}

interface ComputeNode {
  id: string
  name: string
  status: 'online' | 'offline' | 'training'
  cpu: number
  gpu: number
  ram: number
  earningsRate: number
}

interface ActivityEntry {
  id: string
  timestamp: Date
  message: string
  type: 'reward' | 'node' | 'job'
}

interface TrainingJob {
  id: string
  title: string
  modelType: string
  totalReward: number
  timeLeft: string
  participants: number
}

interface AppState {
  networkStats: NetworkStats
  userStats: UserStats
  computeNodes: ComputeNode[]
  activityFeed: ActivityEntry[]
  trainingJobs: TrainingJob[]
  
  // Actions
  updateNetworkStats: () => void
  addActivityEntry: (entry: Omit<ActivityEntry, 'id'>) => void
  updateNodeStatus: (nodeId: string, status: ComputeNode['status']) => void
  claimRewards: () => void
  setComputeNodes: (nodes: ComputeNode[]) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  networkStats: {
    totalDuckEarned: 1247832,
    activeJobs: 23,
    onlineNodes: 1456,
  },
  
  userStats: {
    totalEarned: 2847.5,
    weeklyEarned: 156.2,
    activeNodes: 2,
    pendingRewards: 45.8,
  },
  
  computeNodes: [
    {
      id: '1',
      name: 'Gaming Rig',
      status: 'training',
      cpu: 65,
      gpu: 78,
      ram: 45,
      earningsRate: 12.5,
    },
    {
      id: '2',
      name: 'Home Server',
      status: 'online',
      cpu: 23,
      gpu: 0,
      ram: 67,
      earningsRate: 8.2,
    },
  ],
  
  activityFeed: [
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      message: 'Successfully submitted model update for Job #123. +12.5 $DUCK',
      type: 'reward',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      message: 'Node "Gaming Rig" started training session',
      type: 'node',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      message: 'Claimed 245 $DUCK rewards',
      type: 'reward',
    },
  ],
  
  trainingJobs: [
    {
      id: '1',
      title: 'Image Classification Model',
      modelType: 'CNN',
      totalReward: 5000,
      timeLeft: '2d 14h',
      participants: 156,
    },
    {
      id: '2',
      title: 'Natural Language Processing',
      modelType: 'Transformer',
      totalReward: 8500,
      timeLeft: '5d 8h',
      participants: 89,
    },
    {
      id: '3',
      title: 'Recommendation System',
      modelType: 'Neural Collaborative Filtering',
      totalReward: 3200,
      timeLeft: '1d 6h',
      participants: 234,
    },
  ],
  
  updateNetworkStats: () => {
    set((state) => ({
      networkStats: {
        totalDuckEarned: state.networkStats.totalDuckEarned + Math.floor(Math.random() * 100),
        activeJobs: state.networkStats.activeJobs + (Math.random() > 0.7 ? 1 : 0),
        onlineNodes: state.networkStats.onlineNodes + Math.floor(Math.random() * 10 - 5),
      },
    }))
  },
  
  addActivityEntry: (entry) => {
    set((state) => ({
      activityFeed: [
        { ...entry, id: Date.now().toString() },
        ...state.activityFeed.slice(0, 9), // Keep only 10 entries
      ],
    }))
  },
  
  updateNodeStatus: (nodeId, status) => {
    set((state) => ({
      computeNodes: state.computeNodes.map((node) =>
        node.id === nodeId ? { ...node, status } : node
      ),
    }))
  },
  
  setComputeNodes: (nodes) => {
    set((state) => ({
      computeNodes: nodes,
      userStats: {
        ...state.userStats,
        activeNodes: nodes.filter(n => n.status !== 'offline').length,
      },
    }))
  },
  
  claimRewards: () => {
    const { userStats, addActivityEntry } = get()
    set((state) => ({
      userStats: {
        ...state.userStats,
        totalEarned: state.userStats.totalEarned + state.userStats.pendingRewards,
        pendingRewards: 0,
      },
    }))
    addActivityEntry({
      timestamp: new Date(),
      message: `Claimed ${userStats.pendingRewards} $DUCK rewards`,
      type: 'reward',
    })
  },
}))