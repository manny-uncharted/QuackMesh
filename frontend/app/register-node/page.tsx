'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { WalletConnect } from '@/components/wallet-connect'
import { Server, Download, Settings, Play } from 'lucide-react'

export default function RegisterNodePage() {
  const { isConnected, address } = useAccount()
  const [step, setStep] = useState(1)
  const [nodeConfig, setNodeConfig] = useState({
    name: '',
    endpoint: '',
    pricePerHour: '1.0',
    specs: {
      cpu: 8,
      gpu: 1,
      ram: 16,
    }
  })

  const generateInstallScript = () => {
    return `#!/bin/bash
# QuackMesh Node Setup Script
set -e

echo "🦆 Setting up QuackMesh Node..."

# Install dependencies
pip install -r https://raw.githubusercontent.com/quackmesh/client/main/requirements.txt

# Set environment variables
export ORCHESTRATOR_API="http://localhost:8000/api"
export PROVIDER_PRIVATE_KEY="${address}"
export PROVIDER_ENDPOINT="${nodeConfig.endpoint}"
export PRICE_PER_HOUR_DUCK="${parseFloat(nodeConfig.pricePerHour) * 1e18}"

# Register as provider
python -m quackmesh_client provider

# Start worker server
python -m quackmesh_client worker --host 0.0.0.0 --port 9000

echo "✅ Node registered and running!"
echo "Your node is now earning $DUCK tokens!"
`
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-900 mb-4">Connect Wallet to Register Node</h1>
          <p className="text-gray-600 mb-8">You need to connect your wallet to register a compute node</p>
          <WalletConnect size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-primary-900 mb-4">
              Register Your Compute Node
            </h1>
            <p className="text-xl text-gray-600">
              Start earning $DUCK tokens by contributing your compute power to the network
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= stepNum 
                      ? 'bg-accent-orange text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {stepNum}
                  </div>
                  {stepNum < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      step > stepNum ? 'bg-accent-orange' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="card max-w-2xl mx-auto">
            {step === 1 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Settings className="w-6 h-6 text-accent-orange" />
                  <h2 className="text-2xl font-bold text-gray-900">Configure Your Node</h2>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Node Name
                    </label>
                    <input
                      type="text"
                      value={nodeConfig.name}
                      onChange={(e) => setNodeConfig({...nodeConfig, name: e.target.value})}
                      placeholder="My Gaming Rig"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Public Endpoint
                    </label>
                    <input
                      type="text"
                      value={nodeConfig.endpoint}
                      onChange={(e) => setNodeConfig({...nodeConfig, endpoint: e.target.value})}
                      placeholder="192.168.1.100:9000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      The IP address and port where your node can be reached
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price per Hour ($DUCK)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={nodeConfig.pricePerHour}
                      onChange={(e) => setNodeConfig({...nodeConfig, pricePerHour: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CPU Cores</label>
                      <input
                        type="number"
                        value={nodeConfig.specs.cpu}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig, 
                          specs: {...nodeConfig.specs, cpu: parseInt(e.target.value)}
                        })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">GPU Count</label>
                      <input
                        type="number"
                        value={nodeConfig.specs.gpu}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig, 
                          specs: {...nodeConfig.specs, gpu: parseInt(e.target.value)}
                        })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">RAM (GB)</label>
                      <input
                        type="number"
                        value={nodeConfig.specs.ram}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig, 
                          specs: {...nodeConfig.specs, ram: parseInt(e.target.value)}
                        })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end mt-8">
                  <Button onClick={() => setStep(2)}>
                    Next: Download Client
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Download className="w-6 h-6 text-accent-orange" />
                  <h2 className="text-2xl font-bold text-gray-900">Download & Install</h2>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Installation Script</h3>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                      {generateInstallScript()}
                    </pre>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => navigator.clipboard.writeText(generateInstallScript())}
                    >
                      Copy Script
                    </Button>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Instructions:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
                      <li>Copy the script above</li>
                      <li>Save it as <code>setup-node.sh</code> on your machine</li>
                      <li>Run <code>chmod +x setup-node.sh && ./setup-node.sh</code></li>
                      <li>Your node will automatically register and start earning!</li>
                    </ol>
                  </div>
                </div>
                
                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)}>
                    I've Installed the Client
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Play className="w-6 h-6 text-accent-orange" />
                  <h2 className="text-2xl font-bold text-gray-900">Start Earning</h2>
                </div>
                
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <Server className="w-10 h-10 text-green-600" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Your Node is Ready!
                    </h3>
                    <p className="text-gray-600">
                      Your compute node has been registered and is now available for rent.
                      You'll start earning $DUCK tokens as soon as someone uses your machine for training.
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-accent-orange to-accent-cyan rounded-lg p-6 text-white">
                    <h4 className="font-semibold mb-2">Expected Earnings</h4>
                    <div className="text-2xl font-bold">
                      ~{(parseFloat(nodeConfig.pricePerHour) * 24 * 30).toFixed(0)} $DUCK/month
                    </div>
                    <p className="text-sm opacity-90">
                      Based on {nodeConfig.pricePerHour} $DUCK/hour × 24h/day × 30 days
                    </p>
                  </div>
                  
                  <Button size="lg" onClick={() => window.location.href = '/dashboard'}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}