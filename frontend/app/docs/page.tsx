'use client'

import { useState } from 'react'
import { Navigation } from '@/components/navigation'
import { 
  Book, 
  Code, 
  Server, 
  Zap, 
  Shield, 
  DollarSign,
  ExternalLink,
  Copy,
  CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const CodeBlock = ({ code, language, id }: { code: string, language: string, id: string }) => (
    <div className="relative">
      <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm overflow-x-auto">
        <pre>{code}</pre>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? (
          <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            QuackMesh Documentation
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Complete guide to building, deploying, and earning with the decentralized AI training platform
          </p>
        </div>

        {/* Quick Start */}
        <section className="card mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-accent-orange" />
            <h2 className="text-2xl font-bold text-gray-900">Quick Start</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">For Contributors (Earn $DUCK)</h3>
              <p className="text-gray-600 mb-4">
                Start earning $DUCK tokens by contributing your compute power to the network.
              </p>
              <CodeBlock
                id="contributor-setup"
                language="bash"
                code={`# 1. Connect your wallet on the dashboard
# 2. Register your node and get the setup script
# 3. Run the installation script:

curl -sSL https://get.quackmesh.io/install.sh | bash

# 4. Start your node
quackmesh-client worker --host 0.0.0.0 --port 9000

# 5. Register as provider
quackmesh-client provider --endpoint "your-ip:9000"`}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">For Developers (Rent Compute)</h3>
              <p className="text-gray-600 mb-4">
                Rent distributed compute clusters for your AI training workloads.
              </p>
              <CodeBlock
                id="developer-setup"
                language="bash"
                code={`# 1. Install the QuackMesh client
pip install quackmesh-client

# 2. Set your environment
export ORCHESTRATOR_API="https://api.quackmesh.io"
export API_KEY="your-api-key"

# 3. Browse available nodes
quackmesh-client marketplace search --min-gpu 1

# 4. Rent compute and start training
quackmesh-client rent --machine-ids 1,2,3 --hours 24
quackmesh-client train --job-id 1 --steps 100`}
              />
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="card mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-6 h-6 text-accent-cyan" />
            <h2 className="text-2xl font-bold text-gray-900">Architecture</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">System Components</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Smart Contracts</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• ComputeMarketplace.sol - Node rental system</li>
                    <li>• TrainingPool.sol - Job rewards and validation</li>
                    <li>• InferencePool.sol - Inference job payments</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Orchestrator</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• FastAPI server with async processing</li>
                    <li>• Federated averaging algorithms</li>
                    <li>• Node discovery and health monitoring</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Client Nodes</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• PyTorch training workers</li>
                    <li>• P2P discovery and communication</li>
                    <li>• Encrypted credential handling</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Frontend</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Next.js 14 with real-time updates</li>
                    <li>• Wallet integration (Wagmi/Viem)</li>
                    <li>• Interactive node management</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* API Reference */}
        <section className="card mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Code className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">API Reference</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Core Endpoints</h3>
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">POST</span>
                    <code className="text-sm font-mono">/api/job</code>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Create a new training job</p>
                  <CodeBlock
                    id="create-job"
                    language="json"
                    code={`{
  "model_arch": "mlp_mnist",
  "initial_weights": [],
  "reward_pool_duck": 100.0,
  "huggingface_model_id": "your-username/model-name"
}`}
                  />
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">GET</span>
                    <code className="text-sm font-mono">/api/job/{job_id}/model</code>
                  </div>
                  <p className="text-sm text-gray-600">Fetch the latest global model weights</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">POST</span>
                    <code className="text-sm font-mono">/api/job/{job_id}/update</code>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Submit model update from training</p>
                  <CodeBlock
                    id="submit-update"
                    language="json"
                    code={`{
  "weights": [[0.1, 0.2], [0.3, 0.4]],
  "val_accuracy": 92.5,
  "contributor": "0x1234...5678"
}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="card mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-gray-900">Security & Privacy</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Federated Learning Privacy</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Data Never Leaves Your Device:</strong> Only model updates (gradients/weights) are shared</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Differential Privacy:</strong> Noise is added to updates to prevent data reconstruction</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Secure Aggregation:</strong> Updates are encrypted during transmission and aggregation</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Authentication & Authorization</h3>
              <CodeBlock
                id="auth-example"
                language="bash"
                code={`# API Key Authentication
curl -H "X-API-Key: your-api-key" \\
     -H "Content-Type: application/json" \\
     -X POST https://api.quackmesh.io/job

# JWT Token Authentication  
curl -H "Authorization: Bearer your-jwt-token" \\
     -H "Content-Type: application/json" \\
     -X GET https://api.quackmesh.io/nodes`}
              />
            </div>
          </div>
        </section>

        {/* Tokenomics */}
        <section className="card mb-8">
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-6 h-6 text-accent-orange" />
            <h2 className="text-2xl font-bold text-gray-900">$DUCK Tokenomics</h2>
          </div>
          
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Earning $DUCK</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• <strong>Compute Provision:</strong> 5-50 $DUCK/hour based on specs</li>
                  <li>• <strong>Dataset Contribution:</strong> 10-100 $DUCK per usage</li>
                  <li>• <strong>Model Training:</strong> 1-25 $DUCK per successful update</li>
                  <li>• <strong>Network Validation:</strong> 0.1-5 $DUCK per validation</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Spending $DUCK</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• <strong>Compute Rental:</strong> Market rates (5-50 $DUCK/hour)</li>
                  <li>• <strong>Priority Queuing:</strong> 10% premium for faster jobs</li>
                  <li>• <strong>Premium Features:</strong> Advanced analytics, SLA guarantees</li>
                  <li>• <strong>Governance:</strong> Vote on protocol upgrades</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Deployment */}
        <section className="card mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Deployment Guide</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Local Development</h3>
              <CodeBlock
                id="local-deploy"
                language="bash"
                code={`# Clone the repository
git clone https://github.com/quackmesh/quackmesh
cd quackmesh

# Start the backend services
docker-compose up -d

# Install and start frontend
cd frontend
npm install
npm run dev

# Deploy smart contracts (testnet)
cd ../contracts
npm install
npm run deploy`}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">AWS Production Deployment</h3>
              <CodeBlock
                id="aws-deploy"
                language="bash"
                code={`# 1. Set up AWS infrastructure
terraform init
terraform plan
terraform apply

# 2. Deploy orchestrator to EC2
docker build -t quackmesh-server ./server
docker run -d -p 8000:8000 quackmesh-server

# 3. Configure RDS and ElastiCache
export DATABASE_URL="postgresql://user:pass@rds-endpoint/db"
export REDIS_URL="redis://elasticache-endpoint:6379"

# 4. Deploy frontend to S3/CloudFront
npm run build
aws s3 sync ./out s3://quackmesh-frontend`}
              />
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className="card">
          <div className="flex items-center gap-3 mb-6">
            <Book className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Additional Resources</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Links</h3>
              <ul className="space-y-2">
                <li>
                  <a href="https://github.com/quackmesh/quackmesh" className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                    <ExternalLink className="w-4 h-4" />
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <a href="https://duckchain.io" className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                    <ExternalLink className="w-4 h-4" />
                    DuckChain Documentation
                  </a>
                </li>
                <li>
                  <a href="https://aws.amazon.com/sagemaker" className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                    <ExternalLink className="w-4 h-4" />
                    AWS SageMaker
                  </a>
                </li>
                <li>
                  <a href="https://flower.dev" className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                    <ExternalLink className="w-4 h-4" />
                    Flower Federated Learning
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Support</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• <strong>Discord:</strong> Join our community for help</li>
                <li>• <strong>GitHub Issues:</strong> Report bugs and feature requests</li>
                <li>• <strong>Email:</strong> team@quackmesh.io</li>
                <li>• <strong>Twitter:</strong> @QuackMeshAI for updates</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}