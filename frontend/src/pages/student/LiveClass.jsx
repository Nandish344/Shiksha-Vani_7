import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, HandHelping, ThumbsUp, Users, Volume2 } from 'lucide-react'
import { connectSession } from '../../lib/ws'
import { useI18n, LANGS } from '../../lib/i18n'
import { useAuth } from '../../lib/session'
import { canSpeak, speak } from '../../lib/speech'
import { Chip, KidButton, cx, useToast } from '../../components/ui'

/** Pick the best text for this child from one caption message. */
function forMe(cap, lang) {
  if (lang === cap.lang) return { text: cap.text, lang, note: null }
  const tr = cap.translations?.[lang]
  // Approximate (closest-match) translations are a teacher-only suggestion; never shown to children.
  if (tr && tr.status !== 'missing' && tr.status !== 'approx') return { text: tr.text, lang, note: tr.status === 'verified' ? null : 'draft' }
  const hi = cap.lang === 'hi' ? cap.text : cap.translations?.hi?.text || cap.text
  return { text: hi, lang: 'hi', note: 'missing' }
}

export default function LiveClass() {
  const { code } = useParams()
  const { t, lang } = useI18n()
  const { prefs } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState('connecting')
  const [caps, setCaps] = useState([])
  const [interim, setInterim] = useState('')
  const [people, setPeople] = useState(0)
  const [ended, setEnded] = useState(false)
  const [title, setTitle] = useState('')
  const [cool, setCool] = useState(false)
  const conn = useRef(null)
  const langRef = useRef(lang)
  langRef.current = lang
  const autoRef = useRef(prefs.autoRead)
  autoRef.current = prefs.autoRead

  useEffect(() => {
    conn.current = connectSession(code, {
      onStatus: setStatus,
      onMessage: (m) => {
        if (m.type === 'hello') setTitle(m.session.title)
        if (m.type === 'presence') setPeople(m.students.length)
        if (m.type === 'interim') setInterim(m.text)
        if (m.type === 'caption') {
          setInterim('')
          setCaps((c) => [m, ...c].slice(0, 25))
          if (autoRef.current) { const f = forMe(m, langRef.current); canSpeak(f.lang) && speak(f.text, f.lang) }
        }
        if (m.type === 'caption_patch') setCaps((c) => c.map((x) => (x.seq === m.seq ? { ...x, translations: { ...x.translations, [m.lang]: { text: m.text, status: 'verified', method: 'memory' } } } : x)))
        if (m.type === 'ended') setEnded(true)
      },
    })
    return () => conn.current?.close()
  }, [code])

  const signal = (type) => {
    if (cool) return
    conn.current?.send({ type })
    toast(type === 'confused' ? t('not_understood') + ' ✓' : t('got_it') + ' ✓')
    setCool(true); setTimeout(() => setCool(false), 4000)
  }

  const latest = caps[0] && forMe(caps[0], lang)
  const isOffline = status === 'reconnecting' || status === 'connecting'

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link to="/student" className="inline-flex items-center gap-1 text-sm font-bold text-sal-700"><ChevronLeft size={18} />{t('home')}</Link>
        <span className="flex items-center gap-2 text-sm font-semibold text-sal-700"><Users size={16} />{people} {t('classmates')}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={cx('h-3 w-3 rounded-full', status === 'open' && !ended ? 'bg-madder-500 pulse-ring' : 'bg-slate-300')} />
        <h1 className="truncate text-xl font-extrabold text-sal-800">{title || t('live_now')}</h1>
        {isOffline && <Chip tone="red">{status === 'connecting' ? t('connecting') : t('reconnecting')}</Chip>}
      </div>

      <section className="grow rounded-hero bg-sal-800 p-5 text-white" aria-live="polite">
        {ended ? (
          <div className="grid h-full place-items-center text-center"><p className="font-display text-2xl font-bold">{t('live_ended')}</p><Link to="/student/notes" className="mt-4 rounded-full bg-mahua-400 px-5 py-2 font-bold text-sal-900">{t('notes')}</Link></div>
        ) : !latest ? (
          <div className="grid h-full place-items-center text-center text-sal-200"><p className="font-display text-xl">{t('live_waiting')}</p></div>
        ) : (
          <div key={caps[0].seq} className="rise">
            <p className="font-display text-[34px] font-extrabold leading-tight" lang={latest.lang}>{latest.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {latest.note && <Chip tone="gold">{latest.note === 'missing' ? t('missing_note') : t('draft')}</Chip>}
              {canSpeak(latest.lang) && <button onClick={() => speak(latest.text, latest.lang)} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold"><Volume2 size={16} />{t('listen')}</button>}
            </div>
            {lang !== caps[0].lang && <p className="mt-4 border-t border-white/15 pt-3 text-sm text-sal-200"><span className="font-semibold">{t('original')}: </span>{caps[0].text}</p>}
          </div>
        )}
        {interim && !ended && <p className="mt-4 text-lg italic text-sal-300">{interim}…</p>}
      </section>

      {caps.length > 1 && (
        <ul className="max-h-40 space-y-2 overflow-y-auto">
          {caps.slice(1).map((c) => { const f = forMe(c, lang); return <li key={c.seq} className="rounded-xl bg-white px-3 py-2 text-[15px] text-mist ring-1 ring-line" lang={f.lang}>{f.text}</li> })}
        </ul>
      )}

      {!ended && (
        <div className="grid grid-cols-2 gap-3">
          <KidButton tone="red" disabled={cool || status !== 'open'} onClick={() => signal('confused')} className="flex-col gap-1 py-3 text-base"><HandHelping size={26} />{t('not_understood')}</KidButton>
          <KidButton tone="green" disabled={cool || status !== 'open'} onClick={() => signal('got_it')} className="flex-col gap-1 py-3 text-base"><ThumbsUp size={26} />{t('got_it')}</KidButton>
        </div>
      )}
    </div>
  )
}
