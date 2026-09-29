import { LANGS } from './i18n'

/* ---------------------------------------------------------------- text to speech */
export const canSpeak = (lang) => typeof window !== 'undefined' && 'speechSynthesis' in window && !!LANGS[lang]?.tts

export function speak(text, lang, { rate = 0.88, onEnd } = {}) {
  if (!canSpeak(lang) || !text) return false
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const tag = LANGS[lang].tts
  u.lang = tag
  u.rate = rate
  const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase() === tag.toLowerCase()) ||
    synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2)))
  if (voice) u.voice = voice
  u.onend = () => onEnd?.()
  synth.speak(u)
  return true
}
export const stopSpeaking = () => typeof window !== 'undefined' && window.speechSynthesis?.cancel()

/* ---------------------------------------------------------------- speech to text */
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
export const canListen = () => !!SR

/** Continuous or single-shot recognition. Returns { stop }. */
export function listen({ lang, continuous = false, onInterim, onFinal, onEnd, onError }) {
  if (!SR) { onError?.('unsupported'); return { stop() {} } }
  const rec = new SR()
  rec.lang = LANGS[lang]?.stt || 'en-IN'
  rec.continuous = continuous
  rec.interimResults = true
  rec.maxAlternatives = 1
  let stopped = false
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) onFinal?.(r[0].transcript.trim())
      else interim += r[0].transcript
    }
    if (interim) onInterim?.(interim)
  }
  rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') onError?.(e.error) }
  rec.onend = () => {
    // Chrome stops continuous recognition after silence; restart until the user stops it.
    if (continuous && !stopped) { try { rec.start() } catch { /* already started */ } return }
    onEnd?.()
  }
  try { rec.start() } catch { /* already started */ }
  return { stop() { stopped = true; try { rec.stop() } catch { /* noop */ } } }
}

/* ---------------------------------------------------------------- offline scoring */
const norm = (s) => s.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean)

function ratio(a, b) {
  if (a === b) return 1
  const m = a.length, n = b.length
  if (!m || !n) return 0
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return 1 - prev[n] / Math.max(m, n)
}

/** Same idea as backend/app/services/speech.py so practice works with no connection. */
export function scoreLocal(target, heard, seconds) {
  const t = norm(target), s = norm(heard)
  const display = target.split(/\s+/).filter(Boolean)
  const m = t.length, n = s.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = t[i] === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const status = new Array(m).fill(null), used = new Array(n).fill(false)
  let i = 0, j = 0
  while (i < m && j < n) {
    if (t[i] === s[j]) { status[i] = 'ok'; used[j] = true; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  for (let k = 0; k < m; k++) {
    if (status[k]) continue
    let best = 0, bj = -1
    s.forEach((w, idx) => { if (!used[idx]) { const r = ratio(t[k], w); if (r > best) { best = r; bj = idx } } })
    if (best >= 0.6 && bj >= 0) { status[k] = best >= 0.9 ? 'ok' : 'close'; used[bj] = true } else status[k] = 'missed'
  }
  const ok = status.filter((x) => x === 'ok').length, close = status.filter((x) => x === 'close').length
  const accuracy = m ? Math.round(((ok + 0.6 * close) / m) * 100) : 0
  let fluency = null
  if (seconds > 0.5 && n) { const wpm = (n / seconds) * 60; fluency = wpm >= 40 && wpm <= 120 ? 100 : Math.max(40, Math.round(100 - Math.min(Math.abs(wpm - (wpm < 40 ? 40 : 120)) * 1.2, 60))) }
  const score = fluency == null ? accuracy : Math.round(0.8 * accuracy + 0.2 * fluency)
  return { accuracy, fluency, score, stars: score >= 85 ? 3 : score >= 65 ? 2 : score >= 40 ? 1 : 0, heard, words: t.map((w, k) => ({ word: display.length === m ? display[k] : w, status: status[k] })) }
}

/* ---------------------------------------------------------------- recording */
/** Short voice clip -> data URL (for the community word bank). */
export async function recordClip(maxMs = 6000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = new MediaRecorder(stream)
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.readAsDataURL(blob)
    }
  })
  rec.start()
  const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxMs)
  return { stop: () => { clearTimeout(timer); rec.state !== 'inactive' && rec.stop() }, done }
}

/** Record -> 16 kHz mono WAV (base64). Needed by Bhashini / Whisper for languages the browser can't recognise. */
export async function recordWav(maxMs = 8000) {
  const clip = await recordClip(maxMs)
  const dataUrl = await clip.done
  const buf = await (await fetch(dataUrl)).arrayBuffer()
  return { promise: null, stop: clip.stop, buf }
}

export async function toWavBase64(arrayBuffer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const pcm = (await off.startRendering()).getChannelData(0)
  const wav = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const w = (o, s) => [...s].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); wav.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVEfmt ')
  wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true)
  wav.setUint32(24, 16000, true); wav.setUint32(28, 32000, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true)
  w(36, 'data'); wav.setUint32(40, pcm.length * 2, true)
  pcm.forEach((v, i) => wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  let bin = ''
  new Uint8Array(wav.buffer).forEach((b) => (bin += String.fromCharCode(b)))
  ctx.close()
  return btoa(bin)
}
