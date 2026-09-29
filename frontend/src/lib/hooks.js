import { useCallback, useEffect, useState } from 'react'
import * as api from './api'

export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try { setState({ data: await api.get(path), error: null, loading: false }) }
    catch (error) { setState({ data: null, error, loading: false }) }
  }, [path])
  useEffect(() => { load() }, [load, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) }
}

/** Choose what to show for one translated string, and which voice can read it. */
export function pick(item, view, lang) {
  if (!item) return { text: '', tts: 'hi', fallback: false }
  const en = item.en, hi = item.hi
  if (view === 'hi') return { text: hi, tts: 'hi', fallback: false }
  if (view === 'en') return { text: en, tts: 'en', fallback: false }
  if (lang === 'en') return { text: en, tts: 'en', fallback: false }
  if (lang === 'hi') return { text: hi, tts: 'hi', fallback: false }
  if (item.status === 'missing') return { text: hi, tts: 'hi', fallback: true }
  return { text: item.text, tts: lang, fallback: false }
}

export const weekday = (iso, lang) => new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'narrow' })
