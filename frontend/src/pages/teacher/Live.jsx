import { useCallback, useEffect, useRef, useState } from 'react'
import { HandHelping, Keyboard, Mic, Radio, Send, Square, ThumbsUp, Users, Check, PencilLine } from 'lucide-react'
import * as api from '../../lib/api'
import { connectSession } from '../../lib/ws'
import { LANGS } from '../../lib/i18n'
import { canListen, listen } from '../../lib/speech'
import { Avatar, Button, Chip, ErrorNote, Skeleton, cx, useToast } from '../../components/ui'
import { PageHead, Panel, ago, langName } from './common'

export default function TeacherLive() {
  const [session, setSession] = useState(undefined)
  const [recent, setRecent] = useState([])
  const load = useCallback(async () => {
    const live = await api.get('/api/sessions/live', { cacheIt: false })
    setSession(live[0] || null)
    setRecent(await api.get('/api/sessions/recent', { cacheIt: false }))
  }, [])
  useEffect(() => { load().catch(() => setSession(null)) }, [load])

  if (session === undefined) return <Skeleton className="h-64" />
  return session ? <Console session={session} onEnd={() => { setSession(null); load() }} /> : <Start onStart={setSession} recent={recent} />
}

function Start({ onStart, recent }) {
  const toast = useToast()
  const [title, setTitle] = useState('Plants around us')
  const [src, setSrc] = useState('hi')
  const [busy, setBusy] = useState(false)
  const go = async (e) => {
    e.preventDefault(); setBusy(true)
    try { onStart(await api.post('/api/sessions', { title, source_lang: src })) } catch (err) { toast(err.message, 'err') }
    setBusy(false)
  }
  return (
    <div>
      <PageHead title="Live class" sub="Speak once. Every child reads it in their own mother tongue." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Start a class">
          <form onSubmit={go} className="grid gap-4">
            <label className="grid gap-1 text-sm font-semibold text-sal-800">Topic<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label className="grid gap-1 text-sm font-semibold text-sal-800">You will speak in
              <select className="field" value={src} onChange={(e) => setSrc(e.target.value)}><option value="hi">हिन्दी (Hindi)</option><option value="en">English</option></select>
            </label>
            <Button disabled={busy} className="!min-h-12 text-base"><Radio size={18} />Go live</Button>
            <p className="text-xs text-mist">Children with the app open see a “class is live” banner. Speech recognition runs in Chrome; nothing to install.</p>
          </form>
        </Panel>
        <Panel title="Earlier classes">
          {recent.length === 0 ? <p className="text-sm text-mist">Nothing yet.</p> : (
            <ul className="divide-y divide-line">{recent.map((s) => <li key={s.id} className="flex items-center justify-between py-2.5 text-sm"><span><b className="text-sal-800">{s.title}</b><br /><span className="text-mist">{ago(s.started_at)} · {s.lines} lines</span></span><Chip tone={s.is_live ? 'red' : 'grey'}>{s.is_live ? 'live' : 'ended'}</Chip></li>)}</ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Console({ session, onEnd }) {
  const toast = useToast()
  const [status, setStatus] = useState('connecting')
  const [feed, setFeed] = useState([])
  const [students, setStudents] = useState([])
  const [confused, setConfused] = useState([])
  const [gotIt, setGotIt] = useState(0)
  const [mic, setMic] = useState(false)
  const [interim, setInterim] = useState('')
  const [text, setText] = useState('')
  const [phrases, setPhrases] = useState([])
  const conn = useRef(null)
  const rec = useRef(null)
  const lastInterim = useRef(0)
  const src = session.source_lang

  useEffect(() => {
    api.get('/api/teacher/phrases').then(setPhrases).catch(() => {})
    conn.current = connectSession(session.code, {
      onStatus: setStatus,
      onMessage: (m) => {
        if (m.type === 'presence') setStudents(m.students)
        if (m.type === 'caption') setFeed((f) => [m, ...f].slice(0, 30))
        if (m.type === 'confusion') setConfused((c) => [{ ...m, at: Date.now() }, ...c].slice(0, 20))
        if (m.type === 'got_it') setGotIt((n) => n + 1)
      },
    })
    return () => { rec.current?.stop(); conn.current?.close() }
  }, [session.code])

  const say = (t) => { const v = t.trim(); if (v) conn.current?.send({ type: 'utterance', text: v }) }
  const toggleMic = () => {
    if (mic) { rec.current?.stop(); setMic(false); setInterim(''); return }
    if (!canListen()) return toast('Speech recognition needs Chrome. You can type or tap phrases instead.', 'err')
    rec.current = listen({
      lang: src, continuous: true,
      onInterim: (t) => { setInterim(t); const now = Date.now(); if (now - lastInterim.current > 350) { lastInterim.current = now; conn.current?.send({ type: 'interim', text: t }) } },
      onFinal: (t) => { setInterim(''); say(t) },
      onEnd: () => setMic(false),
      onError: (e) => { setMic(false); toast(e === 'not-allowed' ? 'Microphone is blocked. Allow it in the browser.' : 'Speech recognition stopped.', 'err') },
    })
    setMic(true)
  }
  const end = async () => {
    rec.current?.stop(); conn.current?.send({ type: 'end' })
    try { await api.post(`/api/sessions/${session.id}/end`) } catch { /* already ended */ }
    onEnd()
  }

  const byLang = students.reduce((m, s) => ((m[s.language] ||= []).push(s), m), {})
  return (
    <div>
      <PageHead title={session.title} sub={<span className="inline-flex items-center gap-2"><span className={cx('inline-block h-2.5 w-2.5 rounded-full', status === 'open' ? 'bg-madder-500 pulse-ring' : 'bg-slate-300')} />Class code <b className="text-sal-800">{session.code}</b> · speaking {langName(src)}</span>}>
        <Button variant="danger" onClick={end}><Square size={16} fill="currentColor" />End class</Button>
      </PageHead>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4">
          <Panel>
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={toggleMic} aria-pressed={mic} aria-label={mic ? 'Stop microphone' : 'Start microphone'} disabled={status !== 'open'}
                className={cx('grid h-20 w-20 shrink-0 place-items-center rounded-full text-white shadow-lg transition disabled:opacity-40', mic ? 'bg-madder-500 pulse-ring' : 'bg-sal-700 hover:bg-sal-600')}>
                {mic ? <Square size={28} fill="currentColor" /> : <Mic size={32} />}
              </button>
              <div className="min-w-0 grow">
                <p className="font-display text-xl font-bold text-sal-800">{mic ? 'Listening… speak naturally' : 'Tap the microphone and teach'}</p>
                <p className="min-h-[1.5rem] text-lg italic text-mist" lang={src}>{interim || (status !== 'open' ? 'Connecting…' : '')}</p>
              </div>
            </div>
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); say(text); setText('') }}>
              <div className="relative grow"><Keyboard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" /><input className="field pl-10" lang={src} value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a sentence and press Enter" /></div>
              <Button disabled={!text.trim() || status !== 'open'}><Send size={16} />Send</Button>
            </form>
            {phrases.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">{phrases.slice(0, 10).map((p) => <button key={p.en} disabled={status !== 'open'} onClick={() => say(p[src] || p.hi)} className="rounded-full bg-sal-100 px-3 py-1 text-xs font-semibold text-sal-800 hover:bg-sal-200 disabled:opacity-40" lang={src}>{p[src] || p.hi}</button>)}</div>
            )}
          </Panel>

          {feed.length === 0 && <div className="rounded-2xl border border-dashed border-sal-200 bg-white/60 p-8 text-center text-mist">Captions appear here as you speak, with the translation each child receives.</div>}
          {feed.map((c) => <Caption key={c.seq} cap={c} src={src} conn={conn} />)}
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Listening now" action={<Chip tone="sal"><Users size={13} />{students.length}</Chip>}>
            {students.length === 0 ? <p className="text-sm text-mist">Nobody has joined yet. Children see a red “Class is live” banner on their home screen.</p> : (
              <ul className="space-y-3">{Object.entries(byLang).map(([l, list]) => (
                <li key={l}><p className="mb-1 text-sm font-semibold text-sal-800">{langName(l)} <span className="font-normal text-mist">· {list.length}</span></p><div className="flex flex-wrap gap-1.5">{list.map((s) => <span key={s.id} title={s.name} className="inline-flex items-center gap-1.5 rounded-full bg-sal-50 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-sal-800 ring-1 ring-line"><Avatar emoji={s.avatar} size={24} />{s.name.split(' ')[0]}</span>)}</div></li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Understanding" action={<span className="flex gap-1.5"><Chip tone="red"><HandHelping size={13} />{confused.length}</Chip><Chip tone="sal"><ThumbsUp size={13} />{gotIt}</Chip></span>}>
            {confused.length === 0 ? <p className="text-sm text-mist">When a child taps “I did not get this”, it shows up here instantly.</p> : (
              <ul className="space-y-2">{confused.slice(0, 6).map((c, i) => <li key={i} className="rise flex items-center gap-2.5 rounded-xl bg-madder-50 px-3 py-2 text-sm"><Avatar emoji={c.avatar} size={28} /><span><b>{c.name}</b> needs help</span></li>)}</ul>
            )}
            {confused.length >= 3 && <p className="mt-3 rounded-xl bg-mahua-100 p-3 text-sm font-semibold text-mahua-700">Several children are lost. Slow down and repeat the last idea with an example.</p>}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Caption({ cap, src, conn }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [val, setVal] = useState('')
  const entries = Object.entries(cap.translations).sort(([a], [b]) => (LANGS[a].tribal ? 0 : 1) - (LANGS[b].tribal ? 0 : 1))
  const save = async (lang) => {
    try { await api.post('/api/teacher/translations', { src, tgt: lang, text: cap.text, translation: val }); toast('Saved, and sent to the children now'); cap.translations[lang] = { text: val, status: 'verified', method: 'memory' }; conn.current?.send({ type: 'patch', seq: cap.seq, lang, text: val }); setEditing(null) }
    catch (e) { toast(e.message, 'err') }
  }
  return (
    <article className="card rise p-4">
      <p className="text-2xl font-bold text-sal-800" lang={src}>{cap.text}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {entries.map(([lang, r]) => (
          <li key={lang} className="rounded-xl bg-sal-50 p-3">
            <div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-bold text-sal-700">{langName(lang)}</span>
              <span className="flex items-center gap-1.5">
                {r.status === 'verified' ? <Chip tone="sal"><Check size={12} />checked</Chip> : r.status === 'missing' ? <Chip tone="grey">no translation</Chip> : <Chip tone="gold">{r.status === 'approx' ? `suggestion ${Math.round(r.confidence * 100)}%: not shown to children` : 'draft'}</Chip>}
                {LANGS[lang].tribal && <button className="text-sal-600 hover:text-sal-800" aria-label={`Write ${langName(lang)} translation`} onClick={() => { setEditing(lang); setVal(r.status === 'missing' ? '' : r.text) }}><PencilLine size={15} /></button>}
              </span>
            </div>
            {editing === lang ? (
              <div className="flex gap-1.5"><input autoFocus className="field !py-1.5" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && val.trim() && save(lang)} /><Button className="!px-3" onClick={() => val.trim() && save(lang)}>Save</Button></div>
            ) : r.status === 'missing' ? <p className="text-sm text-mist">Children see the Hindi. Add the {langName(lang)} version with the pencil so it is remembered.</p> : <p className="text-lg text-ink" lang={lang}>{r.text}</p>}
          </li>
        ))}
      </ul>
    </article>
  )
}
