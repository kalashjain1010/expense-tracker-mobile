import { getToken, setToken } from './storage'

export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ||
  'https://trackexpense.vercel.app'
).replace(/\/$/, '')

export function mobileLoginUrl() {
  return `${API_BASE}/auth/google/mobile`
}

async function api(path, options = {}) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({ ok: false, error: 'Bad response' }))
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json.data
}

export async function fetchMe() {
  return api('/api/me')
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' })
  } catch {
    /* ignore */
  }
  await setToken(null)
}

export async function suggestImport(payload) {
  return api('/api/expense/import-suggest', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function confirmImport(payload) {
  return api('/api/expense/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
