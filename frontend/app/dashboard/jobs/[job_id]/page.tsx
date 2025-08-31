"use client"

import { useEffect, useMemo, useState } from 'react'
import { connectLogsWS } from '@/lib/realtime'

export default function JobDetailsPage({ params }: { params: { job_id: string } }) {
  const jobId = params.job_id
  const [logs, setLogs] = useState<{ timestamp: string; level: string; message: string }[]>([])
  const [status, setStatus] = useState<'queued' | 'running' | 'completed'>('running')

  const machineId = useMemo(() => {
    const n = parseInt(jobId, 10)
    return Number.isFinite(n) ? ((n % 3) + 1) : 1
  }, [jobId])

  useEffect(() => {
    const unsubscribe = connectLogsWS(machineId, (log) => {
      setLogs((prev) => [...prev, log as any])
    })
    return () => {
      try { unsubscribe?.() } catch {}
    }
  }, [machineId])

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Job #{jobId}</h1>
        <p className="text-gray-600">Machine ID: {machineId}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-500">Status</div>
          <div className="text-lg font-semibold capitalize">{status}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-500">Model</div>
          <div className="text-lg font-semibold">—</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-gray-500">Dataset</div>
          <div className="text-lg font-semibold">—</div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Live Logs</h2>
        <div className="h-80 overflow-auto bg-gray-50 p-3 rounded">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-sm">Waiting for logs...</div>
          ) : (
            <ul className="space-y-2">
              {logs.map((l, idx) => (
                <li key={idx} className="text-xs font-mono text-gray-800">
                  <span className="text-gray-500">[{new Date(l.timestamp).toLocaleTimeString()}]</span>{' '}
                  <span className="text-blue-600">{l.level}</span>{' '}
                  <span>{l.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
