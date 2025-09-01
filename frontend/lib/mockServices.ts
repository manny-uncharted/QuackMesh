// Utilities for Demo Mode: realistic mock data and job lifecycle simulation

export type MarketplaceNode = {
  machine_id: number
  provider_address: string
  name: string
  location: string
  specs: { cpu: number; gpu: number; ram_gb: number; storage_gb: number }
  price_per_hour: number
  availability: 'available' | 'rented' | 'maintenance'
  rating: number
  total_jobs: number
  uptime: number
  last_active: string
  features: string[]
}

const CITIES = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'London, UK']

function rand(seed: number) {
  // Deterministic PRNG
  let t = seed + 0x6D2B79F5
  return () => {
    t += 0x6D2B79F5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export async function fetchMockMarketplaceNodes(): Promise<MarketplaceNode[]> {
  // Generate 4-6 nodes with variability
  const n = 4 + Math.floor(Math.random() * 3)
  const nodes: MarketplaceNode[] = []
  for (let i = 0; i < n; i++) {
    const id = 100 + i
    const r = rand(id)
    const gpu = Math.random() > 0.5 ? 1 + Math.floor(r() * 4) : 0
    const price = gpu > 0 ? 10 + Math.round(r() * 40) : 8 + Math.round(r() * 15)
    nodes.push({
      machine_id: id,
      provider_address: `0x${Math.floor(r() * 1e16).toString(16).padStart(16, '0')}`,
      name: gpu ? 'AI Workstation' : 'Enterprise Server',
      location: CITIES[Math.floor(r() * CITIES.length)],
      specs: { cpu: 8 + Math.floor(r() * 40), gpu, ram_gb: 16 + Math.floor(r() * 192), storage_gb: 256 + Math.floor(r() * 2000) },
      price_per_hour: Number(price.toFixed(1)),
      availability: r() > 0.2 ? 'available' : 'rented',
      rating: Number((4.2 + r() * 0.8).toFixed(1)),
      total_jobs: 10 + Math.floor(r() * 300),
      uptime: Number((97 + r() * 3).toFixed(1)),
      last_active: `${1 + Math.floor(r() * 5)} minutes ago`,
      features: [gpu ? 'NVIDIA GPU' : 'High-core CPU', 'NVMe SSD', 'Dedicated bandwidth'],
    })
  }
  return nodes
}

// ---- Mock job lifecycle ----
// Persist minimal job info in localStorage

export type MockJobInfo = {
  id: string
  machine_id: number
  mode: 'train' | 'compute'
  created_at: number
}

function readMockJobs(): Record<string, MockJobInfo> {
  try {
    const raw = localStorage.getItem('quackmock:jobs')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMockJobs(map: Record<string, MockJobInfo>) {
  try {
    localStorage.setItem('quackmock:jobs', JSON.stringify(map))
  } catch {}
}

export function createMockJob(machine_id: number, mode: 'train' | 'compute'): string {
  const id = String(Math.floor(Date.now() / 1000))
  const map = readMockJobs()
  map[id] = { id, machine_id, mode, created_at: Date.now() }
  writeMockJobs(map)
  return id
}

export function getMockJobStatus(jobId: string): { status: 'created' | 'running' | 'completed'; flower_running: boolean; has_model: boolean } {
  const map = readMockJobs()
  const info = map[jobId]
  const now = Date.now()
  const dt = info ? (now - info.created_at) / 1000 : 0
  if (dt < 5) return { status: 'created', flower_running: false, has_model: false }
  if (dt < 20) return { status: 'running', flower_running: true, has_model: dt > 12 }
  return { status: 'completed', flower_running: false, has_model: true }
}
