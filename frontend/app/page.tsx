'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { WalletConnect } from '@/components/wallet-connect'
import { NetworkAnimation } from '@/components/network-animation'
import { LiveStats } from '@/components/live-stats'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Download, Shield, DollarSign, Play, ArrowRight } from 'lucide-react'
import { Footer } from '@/components/footer'

export default function HomePage() {
  const { isConnected } = useAccount()
  const router = useRouter()

  // Redirect first-time visitors straight to onboarding
  useEffect(() => {
    try {
      const onboarded = typeof window !== 'undefined' && window.localStorage.getItem('userOnboarded') === 'true'
      if (!onboarded) {
        router.replace('/onboarding')
      }
    } catch {}
  }, [router])

  const handleConnectAndRedirect = () => {
    if (isConnected) {
      try {
        const onboarded = typeof window !== 'undefined' && window.localStorage.getItem('userOnboarded') === 'true'
        if (onboarded) {
          router.push('/dashboard')
        } else {
          router.push('/onboarding')
        }
      } catch {
        router.push('/dashboard')
      }
    }
  }

  const steps = [
    {
      icon: Download,
      title: 'Connect & Download',
      description: 'Connect your wallet and run our light client.',
      color: 'text-accent-cyan',
      bgColor: 'bg-cyan-50',
    },
    {
      icon: Shield,
      title: 'Train Privately',
      description: 'Your device trains the AI model locally. Your data never leaves.',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      icon: DollarSign,
      title: 'Earn $DUCK',
      description: 'Submit the model update and get paid automatically.',
      color: 'text-accent-orange',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">
      {/* Hero Section */}
      <section className="relative px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.h1 
                className="text-5xl lg:text-6xl font-bold text-primary-900 leading-tight mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                Train AI.{' '}
                <span className="gradient-text">Protect Privacy.</span>{' '}
                Earn $DUCK.
              </motion.h1>
              
              <motion.p 
                className="text-xl text-gray-600 mb-8 leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                QuackMesh is the decentralized network for private AI training and compute. 
                Contribute your resources and join the future of ethical AI.
              </motion.p>
              
              <motion.div 
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <WalletConnect 
                  onConnect={handleConnectAndRedirect}
                  size="lg"
                />
                <Button variant="secondary" size="lg" className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  View Demo
                </Button>
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              <NetworkAnimation />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-20 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-primary-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join the decentralized AI revolution in three simple steps
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                className="relative group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <div className="card text-center relative overflow-hidden">
                  <div className={`inline-flex p-4 rounded-2xl ${step.bgColor} mb-6`}>
                    <step.icon className={`w-8 h-8 ${step.color}`} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-primary-900 mb-3">
                    {step.title}
                  </h3>
                  
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                  
                  {/* Step number */}
                  <div className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-500">
                    {index + 1}
                  </div>
                  
                  {/* Arrow for non-last items */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2 text-gray-300">
                      <ArrowRight className="w-6 h-6" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-primary-900 mb-6">
              Ready to Start Earning?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join thousands of contributors already earning $DUCK tokens while advancing AI research.
            </p>
            <WalletConnect 
              onConnect={handleConnectAndRedirect}
              size="lg"
            />
          </motion.div>
        </div>
      </section>

      {/* Live Stats */}
      <LiveStats />
      
      {/* Footer */}
      <Footer />
    </div>
  )
}