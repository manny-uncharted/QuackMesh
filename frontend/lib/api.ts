export const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api'

export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const headers: Record<string, string> = {}
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (apiKey) headers['X-API-Key'] = apiKey
  // Optionally support bearer if provided via env
  const bearer = process.env.NEXT_PUBLIC_BEARER_TOKEN
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`
  return { ...headers, ...extra }
}
