'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { 
  Database, 
  Upload, 
  ExternalLink, 
  Eye, 
  Download,
  DollarSign,
  Calendar,
  Tag,
  FileText,
  BarChart3,
  Plus,
  Search
} from 'lucide-react'

interface Dataset {
  id: number
  name: string
  description: string
  labels: string[]
  format: string
  file_size: number
  owner_address: string
  created_at: string
  usage_count: number
  total_rewards: number
  is_external: boolean
  external_url?: string
}

export default function DatasetsPage() {
  const { isConnected, address } = useAccount()
  const router = useRouter()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    labels: '',
    format: 'CSV',
    external_url: '',
    file: null as File | null
  })

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
      return
    }

    // Mock datasets data
    const mockDatasets: Dataset[] = [
      {
        id: 1,
        name: 'Medical Image Classification Dataset',
        description: 'High-quality medical images for training diagnostic AI models',
        labels: ['medical', 'images', 'classification', 'healthcare'],
        format: 'PNG',
        file_size: 2500000000, // 2.5GB
        owner_address: address || '',
        created_at: '2024-01-10T10:00:00Z',
        usage_count: 15,
        total_rewards: 245.8,
        is_external: false
      },
      {
        id: 2,
        name: 'Financial Time Series Data',
        description: 'Stock market data for algorithmic trading model training',
        labels: ['finance', 'timeseries', 'trading', 'stocks'],
        format: 'CSV',
        file_size: 150000000, // 150MB
        owner_address: address || '',
        created_at: '2024-01-08T14:30:00Z',
        usage_count: 8,
        total_rewards: 89.2,
        is_external: true,
        external_url: 'https://huggingface.co/datasets/financial-data'
      },
      {
        id: 3,
        name: 'Natural Language Processing Corpus',
        description: 'Large text corpus for language model fine-tuning',
        labels: ['nlp', 'text', 'language', 'corpus'],
        format: 'JSON',
        file_size: 5000000000, // 5GB
        owner_address: '0x1234...5678',
        created_at: '2024-01-05T09:15:00Z',
        usage_count: 32,
        total_rewards: 456.7,
        is_external: false
      }
    ]

    setDatasets(mockDatasets)
    setLoading(false)
  }, [isConnected, address, router])

  const filteredDatasets = datasets.filter(dataset =>
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.labels.some(label => label.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleUpload = async () => {
    console.log('Uploading dataset:', uploadForm)
    // TODO: Implement actual upload
    setShowUploadModal(false)
    setUploadForm({
      name: '',
      description: '',
      labels: '',
      format: 'CSV',
      external_url: '',
      file: null
    })
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
            <h1 className="text-3xl font-bold text-gray-900">Datasets</h1>
            <p className="text-gray-600 mt-2">
              Contribute datasets and earn $DUCK tokens when they're used for training
            </p>
          </div>
          <Button onClick={() => setShowUploadModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Upload Dataset
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">My Datasets</p>
                <p className="text-2xl font-bold text-gray-900">
                  {datasets.filter(d => d.owner_address === address).length}
                </p>
              </div>
              <Database className="w-8 h-8 text-accent-cyan" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Usage</p>
                <p className="text-2xl font-bold text-green-600">
                  {datasets.filter(d => d.owner_address === address).reduce((sum, d) => sum + d.usage_count, 0)}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rewards Earned</p>
                <p className="text-2xl font-bold text-accent-orange">
                  {datasets.filter(d => d.owner_address === address).reduce((sum, d) => sum + d.total_rewards, 0).toFixed(1)} $DUCK
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-accent-orange" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Size</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatFileSize(datasets.filter(d => d.owner_address === address).reduce((sum, d) => sum + d.file_size, 0))}
                </p>
              </div>
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="card mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
            />
          </div>
        </div>

        {/* Datasets Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-orange"></div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {filteredDatasets.map((dataset) => (
              <motion.div
                key={dataset.id}
                className="card hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Dataset Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{dataset.name}</h3>
                      {dataset.is_external && (
                        <ExternalLink className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {dataset.description}
                    </p>
                  </div>
                </div>

                {/* Labels */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {dataset.labels.slice(0, 3).map((label, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {label}
                    </span>
                  ))}
                  {dataset.labels.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      +{dataset.labels.length - 3} more
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-gray-600">Format</div>
                    <div className="font-medium">{dataset.format}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Size</div>
                    <div className="font-medium">{formatFileSize(dataset.file_size)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Usage</div>
                    <div className="font-medium">{dataset.usage_count} times</div>
                  </div>
                </div>

                {/* Earnings */}
                <div className="bg-gradient-to-r from-accent-orange/10 to-accent-cyan/10 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Total Rewards</div>
                      <div className="text-lg font-bold text-accent-orange">
                        {dataset.total_rewards} $DUCK
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Per Use</div>
                      <div className="font-medium text-gray-900">
                        {dataset.usage_count > 0 ? (dataset.total_rewards / dataset.usage_count).toFixed(1) : '0'} $DUCK
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(dataset.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    {dataset.owner_address === address && (
                      <Button variant="outline" size="sm">
                        <BarChart3 className="w-3 h-3 mr-1" />
                        Analytics
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Upload Dataset</h3>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dataset Name
                  </label>
                  <input
                    type="text"
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                    placeholder="My awesome dataset"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                    placeholder="Describe your dataset..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Labels (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={uploadForm.labels}
                    onChange={(e) => setUploadForm({...uploadForm, labels: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                    placeholder="machine learning, images, classification"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format
                  </label>
                  <select
                    value={uploadForm.format}
                    onChange={(e) => setUploadForm({...uploadForm, format: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                  >
                    <option value="CSV">CSV</option>
                    <option value="JSON">JSON</option>
                    <option value="Parquet">Parquet</option>
                    <option value="PNG">PNG</option>
                    <option value="JPEG">JPEG</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Method
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="upload_method" defaultChecked />
                        <span>Upload file</span>
                      </label>
                      <input
                        type="file"
                        onChange={(e) => setUploadForm({...uploadForm, file: e.target.files?.[0] || null})}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="upload_method" />
                        <span>External URL (Hugging Face, IPFS, etc.)</span>
                      </label>
                      <input
                        type="url"
                        value={uploadForm.external_url}
                        onChange={(e) => setUploadForm({...uploadForm, external_url: e.target.value})}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="https://huggingface.co/datasets/..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Dataset
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}