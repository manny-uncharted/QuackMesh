import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { modelId, datasetId, machineId, hoursPaid } = body || {}

    if (!machineId || !hoursPaid) {
      return NextResponse.json({ error: 'machineId and hoursPaid are required' }, { status: 400 })
    }

    // Optional: basic validation for Hugging Face IDs
    if (modelId && typeof modelId !== 'string') {
      return NextResponse.json({ error: 'modelId must be a string' }, { status: 400 })
    }
    if (datasetId && typeof datasetId !== 'string') {
      return NextResponse.json({ error: 'datasetId must be a string' }, { status: 400 })
    }

    const jobId = Date.now().toString()
    return NextResponse.json({ jobId })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}
