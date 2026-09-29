import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'
import { I18nContext, makeT } from './i18n'
import { readQueue, writeQueue, uid, clearAll } from './store'

/* ---------------------------------------------------------------- auth + prefs */
const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!api.auth.token)
  const [prefs, setPrefs] = useState(() => ({ scale: Number(localStorage.getItem('sv_scale') || 1), autoRead: localStorage.getItem('sv_autoread') === '1' }))

  useEffect(() => { document.documentElement.style.setProperty('--ui-scale', prefs.scale) }, [prefs.scale])

  useEffect(() => {
    if (!api.auth.token) return
    api.get('/api/auth/me').then(setUser).catch((e) => { if (e.status === 401) api.auth.set('') }).finally(() => setReady(true))
  }, [])

  const finish = ({ token, user }) => { api.auth.set(token); setUser(user); return user }
  const value = useMemo(() => ({
    user, ready, prefs,
    login: (username, password) => api.post('/api/auth/login', { username, password }).then(finish),
    demo: (username) => api.post(`/api/auth/demo/${username}`).then(finish),
    logout: () => { api.auth.set(''); setUser(null); clearAll() },
    setLanguage: async (language) => setUser(await api.patch('/api/auth/me', { language })),
    setPref: (k, v) => setPrefs((p) => { const n = { ...p, [k]: v }; localStorage.setItem('sv_scale', n.scale); localStorage.setItem('sv_autoread', n.autoRead ? '1' : '0'); return n }),
  }), [user, ready, prefs])

  const lang = user?.language || 'en'
  const i18n = useMemo(() => ({ lang, t: makeT(lang) }), [lang])
  return <AuthCtx.Provider value={value}><I18nContext.Provider value={i18n}>{children}</I18nContext.Provider></AuthCtx.Provider>
}

/* ---------------------------------------------------------------- network + offline queue */
const NetCtx = createContext(null)
export const useNet = () => useContext(NetCtx)

export function NetProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const busy = useRef(false)

  const refresh = useCallback(async () => setPending((await readQueue()).length), [])

  const flush = useCallback(async () => {
    if (busy.current || !api.auth.token) return
    const q = await readQueue()
    if (!q.length) return
    busy.current = true; setSyncing(true)
    try {
      const res = await api.post('/api/sync', { events: q.slice(0, 100) })
      const done = new Set(res.accepted)
      await writeQueue((await readQueue()).filter((e) => !done.has(e.id)))
      setLastSync(new Date())
    } catch { /* stay queued, try again later */ }
    busy.current = false; setSyncing(false); refresh()
  }, [refresh])

  const enqueue = useCallback(async (type, payload) => {
    const q = await readQueue()
    q.push({ id: uid(), type, payload, ts: new Date().toISOString() })
    await writeQueue(q)
    refresh()
    if (navigator.onLine) flush()
  }, [flush, refresh])

  useEffect(() => {
    const on = () => { setOnline(true); flush() }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    refresh(); flush()
    // navigator.onLine can lie on weak rural networks, so also probe the API.
    const probe = setInterval(async () => {
      try { await fetch((import.meta.env.VITE_API_URL || '') + '/api/health', { cache: 'no-store' }); setOnline(true); flush() } catch { setOnline(false) }
    }, 20000)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(probe) }
  }, [flush, refresh])

  return <NetCtx.Provider value={{ online, pending, syncing, lastSync, enqueue, flush }}>{children}</NetCtx.Provider>
}
