"use client"

import { useEffect } from "react"
import { useAccount } from "wagmi"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Brain, Database, Server } from "lucide-react"

export default function OnboardingPage() {
  const { isConnected } = useAccount()
  const router = useRouter()

  useEffect(() => {
    if (!isConnected) router.push("/")
  }, [isConnected, router])

  const choose = (path: string) => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("userOnboarded", "true")
      }
    } catch {}
    router.push(path)
  }

  if (!isConnected) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl font-bold text-gray-900">How do you want to contribute to QuackMesh?</h1>
          <p className="text-gray-600 mt-2">Choose your path to start earning $DUCK.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          <motion.div className="card text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-2xl bg-purple-50">
                <Brain className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Train AI Models</h3>
            <p className="text-gray-600 mb-4">Bring your own model and dataset. Rent decentralized compute to train your AI.</p>
            <Button onClick={() => choose("/marketplace?type=train")}>Start Training</Button>
          </motion.div>

          <motion.div className="card text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-2xl bg-blue-50">
                <Database className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Contribute a Dataset</h3>
            <p className="text-gray-600 mb-4">Monetize your data. Contribute to public datasets and earn rewards when they're used.</p>
            <Button variant="secondary" onClick={() => choose("/datasets")}>Submit Dataset</Button>
          </motion.div>

          <motion.div className="card text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-2xl bg-green-50">
                <Server className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Setup a Compute Node</h3>
            <p className="text-gray-600 mb-4">Rent out your idle compute power. Get paid in $DUCK for providing resources to the network.</p>
            <Button variant="outline" onClick={() => choose("/register-node")}>Setup Node</Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
