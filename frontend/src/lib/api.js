import { cache } from './store'

const BASE = import.meta.env.VITE_API_URL || ''
let token = localStorage.getItem('sv_token') || ''

export const auth = {
  get token() { return token },
  set(t) { token = t; t ? localStorage.setItem('sv_token', t) : localStorage.removeItem('sv_token') },
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

async function raw(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  })
  if (!res.ok) {
    let msg = 'Something went wrong. Please try again.'
    try { const j = await res.json(); if (typeof j.detail === 'string') msg = j.detail } catch { /* not json */ }
    throw new ApiError(msg, res.status)
  }
  return res
}

/** GET with an offline safety net: last good answer is served when the network is gone. */
export async function get(path, { cacheIt = true } = {}) {
  try {
    const res = await raw(path)
    const data = await res.json()
    if (cacheIt) cache.set(`${token.slice(-8)}:${path}`, data)
    return data
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) throw err // real API answers are not retried from cache
    const hit = await cache.get(`${token.slice(-8)}:${path}`)
    if (hit) return Object.assign(Array.isArray(hit.v) ? [...hit.v] : { ...hit.v }, { __offline: true })
    throw new ApiError('You are offline and this is not saved yet.', 0)
  }
}

export const post = (path, body) => raw(path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json())
export const patch = (path, body) => raw(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }).then((r) => r.json())

export async function download(path, filename) {
  const res = await raw(path)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function wsUrl(path) {
  const base = import.meta.env.VITE_API_URL
  if (base) return base.replace(/^http/, 'ws') + path
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`
}
