// Normalize API base: if env is a relative path ensure it starts with '/'. Default to '/api'.
const rawApiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '/api').trim()
export const apiBase = rawApiBase.startsWith('http')
  ? rawApiBase.replace(/\/$/, '')
  : ('/' + rawApiBase.replace(/^\/*/, '')).replace(/\/$/, '')

export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const headers: Record<string, string> = {}
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (apiKey) headers['X-API-Key'] = apiKey
  // Optionally support bearer if provided via env
  const bearer = process.env.NEXT_PUBLIC_BEARER_TOKEN
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`
  return { ...headers, ...extra }
}
