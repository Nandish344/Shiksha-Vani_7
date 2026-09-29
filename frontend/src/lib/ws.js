import { wsUrl, auth } from './api'

/** Auto-reconnecting WebSocket. Calls onStatus('open'|'connecting'|'closed'|'gone'). */
export function connectSession(code, { onMessage, onStatus }) {
  let ws, closed = false, retry = 0, timer
  const open = () => {
    onStatus?.(retry ? 'reconnecting' : 'connecting')
    ws = new WebSocket(wsUrl(`/ws/session/${code}?token=${encodeURIComponent(auth.token)}`))
    ws.onopen = () => { retry = 0; onStatus?.('open') }
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch { /* ignore */ } }
    ws.onclose = (e) => {
      if (closed) return
      if (e.code === 4404 || e.code === 4401) { onStatus?.('gone'); return }
      onStatus?.('reconnecting')
      timer = setTimeout(open, Math.min(1000 * 2 ** retry++, 8000))
    }
    ws.onerror = () => ws.close()
  }
  open()
  return {
    send: (obj) => ws?.readyState === 1 && ws.send(JSON.stringify(obj)),
    close: () => { closed = true; clearTimeout(timer); ws?.close() },
  }
}
