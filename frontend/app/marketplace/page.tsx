'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  Filter, 
  Server, 
  Cpu, 
  HardDrive, 
  Zap,
  Clock,
  DollarSign,
  Star,
  MapPin,
  Wifi
} from 'lucide-react'

interface MarketplaceNode {
  machine_id: number
  provider_address: string
  name: string
  location: string
  specs: {
    cpu: number
    gpu: number
    ram_gb: number
    storage_gb: number
  }
  price_per_hour: number
  availability: 'available' | 'rented' | 'maintenance'
  rating: number
  total_jobs: number
  uptime: number
  last_active: string
  features: string[]
}

export default function MarketplacePage() {
  const { isConnected } = useAccount()
  const router = useRouter()
  const [nodes, setNodes] = useState<MarketplaceNode[]>([])
  const [filteredNodes, setFilteredNodes] = useState<MarketplaceNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    minCpu: '',
    minGpu: '',
    minRam: '',
    maxPrice: '',
    availability: 'available'
  })

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
      return
    }

    // Mock marketplace data
    const mockNodes: MarketplaceNode[] = [
      {
        machine_id: 101,
        provider_address: '0x1234...5678',
        name: 'High-Performance GPU Rig',
        location: 'San Francisco, CA',
        specs: { cpu: 16, gpu: 2, ram_gb: 64, storage_gb: 1000 },
        price_per_hour: 25.5,
        availability: 'available',
        rating: 4.9,
        total_jobs: 156,
        uptime: 99.2,
        last_active: '2 minutes ago',
        features: ['NVIDIA RTX 4090', 'High-speed SSD', 'Dedicated bandwidth']
      },
      {
        machine_id: 102,
        provider_address: '0x2345...6789',
        name: 'Enterprise Server',
        location: 'New York, NY',
        specs: { cpu: 32, gpu: 0, ram_gb: 128, storage_gb: 2000 },
        price_per_hour: 18.0,
        availability: 'available',
        rating: 4.7,
        total_jobs: 89,
        uptime: 98.8,
        last_active: '5 minutes ago',
        features: ['Intel Xeon', 'ECC Memory', '24/7 monitoring']
      },
      {
        machine_id: 103,
        provider_address: '0x3456...7890',
        name: 'Budget Training Node',
        location: 'Austin, TX',
        specs: { cpu: 8, gpu: 1, ram_gb: 32, storage_gb: 500 },
        price_per_hour: 12.0,
        availability: 'available',
        rating: 4.5,
        total_jobs: 234,
        uptime: 97.5,
        last_active: '1 minute ago',
        features: ['GTX 1080 Ti', 'Cost-effective', 'Reliable']
      },
      {
        machine_id: 104,
        provider_address: '0x4567...8901',
        name: 'AI Workstation Pro',
        location: 'Seattle, WA',
        specs: { cpu: 24, gpu: 4, ram_gb: 96, storage_gb: 1500 },
        price_per_hour: 45.0,
        availability: 'rented',
        rating: 5.0,
        total_jobs: 67,
        uptime: 99.8,
        last_active: '30 seconds ago',
        features: ['4x RTX 4080', 'NVLink', 'Liquid cooling']
      }
    ]

    setNodes(mockNodes)
    setFilteredNodes(mockNodes.filter(n => n.availability === 'available'))
    setLoading(false)
  }, [isConnected, router])

  useEffect(() => {
    let filtered = nodes.filter(node => {
      // Search filter
      if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !node.location.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      // Spec filters
      if (filters.minCpu && node.specs.cpu < parseInt(filters.minCpu)) return false
      if (filters.minGpu && node.specs.gpu < parseInt(filters.minGpu)) return false
      if (filters.minRam && node.specs.ram_gb < parseInt(filters.minRam)) return false
      if (filters.maxPrice && node.price_per_hour > parseFloat(filters.maxPrice)) return false
      if (filters.availability && node.availability !== filters.availability) return false

      return true
    })

    setFilteredNodes(filtered)
  }, [nodes, searchTerm, filters])

  const handleRentNode = (nodeId: number) => {
    console.log(`Renting node ${nodeId}`)
    // TODO: Implement rental flow with smart contract interaction
  }

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'rented': return 'bg-orange-100 text-orange-800'
      case 'maintenance': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isConnected) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Compute Marketplace</h1>
          <p className="text-gray-600">
            Rent high-performance compute nodes for your AI training and inference tasks
          </p>
        </div>

        {/* Search and Filters */}
        <div className="card mb-8">
          <div className="grid md:grid-cols-6 gap-4">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div>
              <input
                type="number"
                placeholder="Min CPU"
                value={filters.minCpu}
                onChange={(e) => setFilters({...filters, minCpu: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="number"
                placeholder="Min GPU"
                value={filters.minGpu}
                onChange={(e) => setFilters({...filters, minGpu: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="number"
                placeholder="Min RAM (GB)"
                value={filters.minRam}
                onChange={(e) => setFilters({...filters, minRam: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="number"
                placeholder="Max Price/hr"
                value={filters.maxPrice}
                onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {filteredNodes.length} nodes available
          </p>
          <div className="flex gap-2">
            <Button
              variant={filters.availability === 'available' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilters({...filters, availability: 'available'})}
            >
              Available
            </Button>
            <Button
              variant={filters.availability === '' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilters({...filters, availability: ''})}
            >
              All
            </Button>
          </div>
        </div>

        {/* Nodes Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-orange"></div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredNodes.map((node) => (
              <motion.div
                key={node.machine_id}
                className="card hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Node Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{node.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-3 h-3" />
                      {node.location}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(node.availability)}`}>
                    {node.availability}
                  </span>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{node.specs.cpu} CPU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{node.specs.gpu} GPU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{node.specs.ram_gb}GB RAM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{node.specs.storage_gb}GB</span>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {node.features.slice(0, 2).map((feature, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {feature}
                      </span>
                    ))}
                    {node.features.length > 2 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{node.features.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span className="text-sm font-medium">{node.rating}</span>
                    </div>
                    <div className="text-xs text-gray-600">Rating</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{node.total_jobs}</div>
                    <div className="text-xs text-gray-600">Jobs</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{node.uptime}%</div>
                    <div className="text-xs text-gray-600">Uptime</div>
                  </div>
                </div>

                {/* Pricing and Action */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-accent-orange" />
                        <span className="text-lg font-bold text-gray-900">
                          {node.price_per_hour}
                        </span>
                        <span className="text-sm text-gray-600">$DUCK/hr</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Wifi className="w-3 h-3" />
                        {node.last_active}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRentNode(node.machine_id)}
                      disabled={node.availability !== 'available'}
                      size="sm"
                    >
                      {node.availability === 'available' ? 'Rent Now' : 'Unavailable'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {filteredNodes.length === 0 && !loading && (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No nodes found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}