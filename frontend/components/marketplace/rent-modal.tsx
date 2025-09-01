"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { ComputeMarketplaceABI } from "@/lib/abi/ComputeMarketplace"
import { decodeEventLog, type Hex } from "viem"
import { useConnection } from "@/lib/connection"
import { createMockJob } from "@/lib/mockServices"

export type RentMode = "train" | "compute"

export interface RentModalProps {
  open: boolean
  onClose: () => void
  node: {
    machine_id: number
    price_per_hour: number
    name: string
  } | null
  defaultMode?: RentMode
}

async function hfExists(kind: "models" | "datasets", id: string): Promise<boolean> {
  if (!id) return false
  try {
    const r = await fetch(`https://huggingface.co/api/${kind}/${encodeURIComponent(id)}`)
    return r.ok
  } catch {
    return false
  }
}

export function RentModal({ open, onClose, node, defaultMode = "train" }: RentModalProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { mode: globalMode, isBlockchainAlive, isHuggingFaceReachable } = useConnection()

  const [mode, setMode] = useState<RentMode>(defaultMode)
  const [hours, setHours] = useState<string>("1")
  const [modelId, setModelId] = useState("")
  const [datasetId, setDatasetId] = useState("")
  const [checking, setChecking] = useState(false)
  const [modelOk, setModelOk] = useState<boolean | null>(null)
  const [datasetOk, setDatasetOk] = useState<boolean | null>(null)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMode(defaultMode)
  }, [defaultMode])

  useEffect(() => {
    if (!open) {
      setModelId("")
      setDatasetId("")
      setModelOk(null)
      setDatasetOk(null)
      setTxHash(null)
      setError(null)
      setHours("1")
    }
  }, [open])

  const renting = useMemo(() => !!txHash, [txHash])

  const { data: receipt, isLoading: waitingReceipt } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: !!txHash },
  })

  useEffect(() => {
    if (!receipt || !publicClient) return
    try {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ComputeMarketplaceABI as any,
            data: log.data,
            topics: log.topics as any,
          }) as unknown as { eventName: string; args?: Record<string, unknown> }
          if (decoded.eventName === "TrainingJobCreated") {
            const jobId = (decoded.args?.jobId as any)?.toString?.() ?? ""
            if (jobId) {
              window.location.href = `/dashboard/jobs/${jobId}`
              return
            }
          }
        } catch {}
      }
      // Fallback: go to dashboard if no jobId found
      window.location.href = "/dashboard"
    } catch {}
  }, [receipt, publicClient])

  const validateHf = async () => {
    // In demo mode or if HF is unreachable, bypass validation and optimistically accept
    if (globalMode === 'demo' || !isHuggingFaceReachable) {
      setModelOk(!!modelId)
      setDatasetOk(true)
      return
    }
    setChecking(true)
    const [mOk, dOk] = await Promise.all([
      hfExists("models", modelId),
      datasetId ? hfExists("datasets", datasetId) : Promise.resolve(true),
    ])
    setModelOk(mOk)
    setDatasetOk(dOk)
    setChecking(false)
    if (!mOk) throw new Error("Model ID not found on Hugging Face")
    if (!dOk) throw new Error("Dataset ID not found on Hugging Face")
  }

  const onRent = async () => {
    if (!node || !isConnected) return
    setError(null)
    try {
      // Demo mode or chain unavailable: simulate rent + job and navigate
      if (globalMode === 'demo' || !isBlockchainAlive) {
        if (mode === 'train') {
          if (modelId) {
            await validateHf()
          }
        }
        const jobId = createMockJob(node.machine_id, mode)
        window.location.href = `/dashboard/jobs/${jobId}`
        return
      }

      const addressStr = process.env.NEXT_PUBLIC_COMPUTE_MARKETPLACE_ADDRESS
      if (!addressStr) throw new Error("Marketplace address not configured")
      const machineId = BigInt(node.machine_id)
      const hoursPaid = BigInt(Math.max(1, Number(hours) || 1))

      if (mode === "train") {
        await validateHf()
        const hash = await writeContractAsync({
          abi: ComputeMarketplaceABI as any,
          address: addressStr as `0x${string}`,
          functionName: "rentMachineWithJob",
          args: [machineId, hoursPaid, modelId, datasetId],
        })
        setTxHash(hash as Hex)
      } else {
        const hash = await writeContractAsync({
          abi: ComputeMarketplaceABI as any,
          address: addressStr as `0x${string}`,
          functionName: "rentMachine",
          args: [machineId, hoursPaid],
        })
        setTxHash(hash as Hex)
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to send transaction")
    }
  }

  if (!open || !node) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-lg rounded-xl shadow-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Rent “{node.name}”</h3>
            <p className="text-xs text-gray-500">{node.price_per_hour} $DUCK/hr</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} disabled={renting || waitingReceipt}>Close</Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "train" ? "primary" : "outline"} size="sm" onClick={() => setMode("train")}>Train a Model</Button>
            <Button variant={mode === "compute" ? "primary" : "outline"} size="sm" onClick={() => setMode("compute")}>Raw Compute</Button>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Hours</label>
            <input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} className="w-32 px-3 py-2 border rounded-md" />
          </div>

          {mode === "train" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Hugging Face Model ID</label>
                <input
                  type="text"
                  placeholder="e.g., google/vit-base-patch16-224"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">The model repository ID from Hugging Face Hub.</p>
                {modelOk === false && <p className="text-xs text-red-600 mt-1">Model not found</p>}
                {modelOk === true && <p className="text-xs text-green-600 mt-1">Model verified</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Hugging Face Dataset ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., cifar10"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">The dataset repository ID from Hugging Face Hub. Leave blank to use your own data.</p>
                {datasetId && datasetOk === false && <p className="text-xs text-red-600 mt-1">Dataset not found</p>}
                {datasetId && datasetOk === true && <p className="text-xs text-green-600 mt-1">Dataset verified</p>}
              </div>

              <div>
                <Button onClick={async () => { try { await validateHf() } catch (e) {} }} variant="outline" size="sm" disabled={checking || !modelId}>Validate IDs</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
              You are renting this node for raw computational power. You will be responsible for deploying your own environment and scripts.
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={renting || waitingReceipt}>Cancel</Button>
          <Button onClick={onRent} disabled={waitingReceipt || (mode === "train" && !modelId)}>
            {waitingReceipt ? "Waiting..." : renting ? "Submitted" : "Rent"}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
