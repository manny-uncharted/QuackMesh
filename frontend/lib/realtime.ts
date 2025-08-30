export type ComputeNode = {
  id: string
  name: string
  status: 'online' | 'offline' | 'training'
  cpu: number
  gpu: number
  ram: number
  earningsRate: number
}

function deriveWsBaseUrl(): string {
  const httpBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'
  // Strip trailing /api to get server root
  let url = httpBase.replace(/\/?api\/?$/, '')
  // http -> ws, https -> wss
  if (url.startsWith('https://')) url = 'wss://' + url.slice('https://'.length)
  else if (url.startsWith('http://')) url = 'ws://' + url.slice('http://'.length)
  return url
}

function createReconnectingWS(url: string, onMessage: (ev: MessageEvent) => void): () => void {
  let ws: WebSocket | null = null
  let timer: any = null
  let stopped = false

  const open = () => {
    if (stopped) return
    try {
      ws = new WebSocket(url)
      ws.onmessage = onMessage
      const schedule = () => {
        if (stopped) return
        timer = setTimeout(open, 2000)
      }
      ws.onclose = schedule
      ws.onerror = schedule
    } catch {
      // schedule retry if constructor throws
      timer = setTimeout(open, 2000)
    }
  }

  open()

  return () => {
    stopped = true
    if (timer) { try { clearTimeout(timer) } catch {} }
    if (ws) { try { ws.onclose = null; ws.onerror = null; ws.close() } catch {} }
    ws = null
  }
}

export function connectNodesWS(onNodes: (nodes: ComputeNode[]) => void): () => void {
  const wsUrl = `${deriveWsBaseUrl()}/ws/nodes`
  return createReconnectingWS(wsUrl, (ev) => {
    try {
      const data = JSON.parse(ev.data as string)
      const nodes = Array.isArray(data?.nodes) ? data.nodes : []
      const mapped: ComputeNode[] = nodes.map((n: any) => {
        const m = n?.metrics || {}
        const cpu = typeof m.cpu === 'number' ? Math.max(0, Math.min(100, m.cpu)) : 0
        const ram = typeof m.ram_pct === 'number' ? Math.max(0, Math.min(100, m.ram_pct)) : 0
        const gpu = typeof m.gpu === 'number' ? Math.max(0, Math.min(100, m.gpu)) : 0
        const name = n?.endpoint || `Node #${n?.machine_id ?? 'unknown'}`
        return {
          id: String(n?.machine_id ?? name),
          name,
          status: (n?.status ?? 'offline') as ComputeNode['status'],
          cpu,
          gpu,
          ram,
          earningsRate: 0,
        }
      })
      onNodes(mapped)
    } catch {
      // ignore malformed messages
    }
  })
}

export function connectLogsWS(machineId: number, onLogs: (lines: string[]) => void): () => void {
  const wsUrl = `${deriveWsBaseUrl()}/ws/nodes/${machineId}/logs`
  return createReconnectingWS(wsUrl, (ev) => {
    try {
      const data = JSON.parse(ev.data as string)
      const lines = Array.isArray(data?.logs) ? (data.logs as string[]) : []
      onLogs(lines)
    } catch {
      // ignore
    }
  })
}
