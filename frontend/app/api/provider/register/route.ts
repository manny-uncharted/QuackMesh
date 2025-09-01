import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    // Use server-side backend base to avoid recursive proxying
    const base = process.env.BACKEND_API_BASE_URL || 'http://localhost:8000/api'
    const url = `${base.replace(/\/$/, '')}/provider/register`

    // Forward client-provided headers if present; fallback to server env
    const inApiKey = req.headers.get('x-api-key')
    const inAuth = req.headers.get('authorization')
    const fallbackKey = process.env.ORCHESTRATOR_API_KEY || process.env.NEXT_PUBLIC_API_KEY

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (inApiKey) headers['X-API-Key'] = inApiKey
    else if (fallbackKey) headers['X-API-Key'] = fallbackKey
    if (inAuth) headers['Authorization'] = inAuth

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    })

    const text = await res.text()
    return new Response(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ detail: e?.message || 'Proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
