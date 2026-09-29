import { get, set, del, keys } from 'idb-keyval'

/** Everything the app must remember while offline lives in IndexedDB. */
export const cache = {
  get: (k) => get(`cache:${k}`).catch(() => undefined),
  set: (k, v) => set(`cache:${k}`, { v, at: Date.now() }).catch(() => {}),
}

export async function readQueue() {
  return (await get('queue').catch(() => [])) || []
}
export async function writeQueue(q) {
  await set('queue', q).catch(() => {})
}

export async function markDownloaded(id, lang, on = true) {
  const list = new Set((await get('downloads').catch(() => [])) || [])
  const key = `${id}:${lang}`
  on ? list.add(key) : list.delete(key)
  await set('downloads', [...list]).catch(() => {})
}
export async function readDownloads() {
  return (await get('downloads').catch(() => [])) || []
}

export async function clearAll() {
  const all = await keys()
  await Promise.all(all.map((k) => del(k)))
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
