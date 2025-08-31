// Real-time WebSocket connections for live updates

export interface NodeUpdate {
  type: 'node_status_update'
  machine_id: number
  status: string
  usage: {
    cpu_percent: number
    memory_percent: number
    gpu_percent?: number
  }
  timestamp: string
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
  metadata?: any
}

export function connectNodesWS(onUpdate: (update: NodeUpdate) => void): (() => void) | undefined {
  try {
    // In a real implementation, this would connect to the WebSocket endpoint
    // For demo purposes, we'll simulate updates
    const interval = setInterval(() => {
      const mockUpdate: NodeUpdate = {
        type: 'node_status_update',
        machine_id: Math.floor(Math.random() * 3) + 1,
        status: ['online', 'training', 'offline'][Math.floor(Math.random() * 3)],
        usage: {
          cpu_percent: Math.floor(Math.random() * 100),
          memory_percent: Math.floor(Math.random() * 100),
          gpu_percent: Math.floor(Math.random() * 100),
        },
        timestamp: new Date().toISOString(),
      }
      onUpdate(mockUpdate)
    }, 5000)

    return () => clearInterval(interval)
  } catch (error) {
    console.error('Failed to connect to nodes WebSocket:', error)
    return undefined
  }
}

export function connectLogsWS(machineId: number, onLog: (log: LogEntry) => void): () => void {
  try {
    // Simulate log streaming
    const logs = [
      'Starting training session...',
      'Loading model weights from orchestrator',
      'Initializing local dataset',
      'Training epoch 1/10 - Loss: 0.245',
      'Training epoch 2/10 - Loss: 0.198',
      'Training epoch 3/10 - Loss: 0.167',
      'Validation accuracy: 89.2%',
      'Submitting model update to orchestrator',
      'Update accepted - Reward: +12.5 $DUCK',
      'Training session completed successfully'
    ]

    let logIndex = 0
    const interval = setInterval(() => {
      if (logIndex < logs.length) {
        const mockLog: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: logs[logIndex],
        }
        onLog(mockLog)
        logIndex++
      } else {
        // Reset and continue with new logs
        logIndex = 0
      }
    }, 2000)

    return () => clearInterval(interval)
  } catch (error) {
    console.error('Failed to connect to logs WebSocket:', error)
    return () => {}
  }
}

export function connectMarketplaceWS(onUpdate: (data: any) => void): (() => void) | undefined {
  try {
    // Simulate marketplace updates
    const interval = setInterval(() => {
      const mockUpdate = {
        type: 'marketplace_update',
        new_listings: Math.floor(Math.random() * 5),
        price_changes: Math.floor(Math.random() * 10),
        rentals: Math.floor(Math.random() * 3),
        timestamp: new Date().toISOString(),
      }
      onUpdate(mockUpdate)
    }, 10000)

    return () => clearInterval(interval)
  } catch (error) {
    console.error('Failed to connect to marketplace WebSocket:', error)
    return undefined
  }
}

export function connectAnalyticsWS(onUpdate: (data: any) => void): (() => void) | undefined {
  try {
    // Simulate analytics updates
    const interval = setInterval(() => {
      const mockUpdate = {
        type: 'analytics_update',
        total_earnings: Math.random() * 1000 + 2000,
        active_nodes: Math.floor(Math.random() * 10) + 5,
        completed_jobs: Math.floor(Math.random() * 50) + 100,
        timestamp: new Date().toISOString(),
      }
      onUpdate(mockUpdate)
    }, 15000)

    return () => clearInterval(interval)
  } catch (error) {
    console.error('Failed to connect to analytics WebSocket:', error)
    return undefined
  }
}