import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, HandHelping, Volume2, Info } from 'lucide-react'
import { useI18n, LANGS } from '../../lib/i18n'
import { useLoad, pick } from '../../lib/hooks'
import { useAuth, useNet } from '../../lib/session'
import { canSpeak, speak } from '../../lib/speech'
import { Chip, ErrorNote, KidButton, Segmented, Skeleton, StatusPill, cx, useToast } from '../../components/ui'

export default function Lesson() {
  const { id } = useParams()
  const { t, lang } = useI18n()
  const { prefs } = useAuth()
  const { enqueue } = useNet()
  const toast = useToast()
  const nav = useNavigate()
  const { data: l, error, loading, reload } = useLoad(`/api/lessons/${id}?lang=${lang}`, [lang])
  const [view, setView] = useState('own')
  const [flagged, setFlagged] = useState({})
  const opened = useRef(Date.now())
  const reported = useRef(false)

  useEffect(() => { opened.current = Date.now(); reported.current = false }, [id])

  const finish = () => {
    if (!reported.current) {
      reported.current = true
      enqueue('attempt', { kind: 'lesson', lesson_id: Number(id), score: 100, seconds: Math.round((Date.now() - opened.current) / 1000) })
    }
    nav(`/student/quiz/${id}`)
  }
  const confused = (sectionId) => {
    setFlagged((f) => ({ ...f, [sectionId]: true }))
    enqueue('confusion', { lesson_id: Number(id), note: `section ${sectionId}` })
    toast(t('not_understood') + ' ✓')
  }
  const say = (p) => speak(p.text, p.tts)

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
  if (error) return <ErrorNote error={error} retry={reload} />

  const own = lang === 'hi' || lang === 'en' ? null : { value: 'own', label: t('mother_tongue') }
  const options = [own, { value: 'hi', label: 'हिन्दी' }, { value: 'en', label: 'English' }].filter(Boolean)
  const v = own ? view : view === 'own' ? lang : view
  const title = pick({ text: l.title, en: l.title_en, hi: l.title_hi, status: l.title_status }, v, lang)
  const showBoth = lang !== 'hi' && lang !== 'en' && v === 'own'
  const unsure = l.verified < 1
  const mostMissing = v === lang && lang !== 'hi' && lang !== 'en' && l.sections.filter((s) => s.status === 'missing').length > l.sections.length / 2

  return (
    <div className="space-y-5 pb-4">
      <Link to="/student/lessons" className="inline-flex items-center gap-1 text-sm font-bold text-sal-700"><ChevronLeft size={18} />{t('lessons')}</Link>
      <header className="flex items-center gap-4">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-white text-5xl shadow-card">{l.emoji}</span>
        <div className="min-w-0"><h1 className="text-[28px] font-extrabold leading-tight text-sal-800" lang={title.tts}>{title.text}</h1>{showBoth && l.title_hi !== title.text && <p className="text-sm text-mist">{l.title_hi}</p>}</div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={own ? view : v} onChange={setView} options={options} />
        {l.__offline && <Chip tone="red">{t('offline')}</Chip>}
      </div>

      {(mostMissing || (unsure && lang !== 'hi' && lang !== 'en')) && (
        <p className="flex gap-2 rounded-2xl bg-mahua-100 p-3 text-sm text-mahua-700"><Info size={18} className="mt-0.5 shrink-0" />{mostMissing ? t('missing_note') : t('draft_note')}</p>
      )}

      <ol className="space-y-3">
        {l.sections.map((s, n) => {
          const p = pick(s, v, lang)
          const canSay = canSpeak(p.tts)
          return (
            <li key={s.id} className="card rise p-4" style={{ animationDelay: `${n * 50}ms` }}>
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sal-800 font-display text-sm font-bold text-mahua-300">{n + 1}</span>
                <div className="min-w-0 grow">
                  <p className="text-[22px] leading-snug text-ink" lang={p.tts}>{p.text}</p>
                  {showBoth && !p.fallback && <p className="mt-1 text-[15px] text-mist" lang="hi">{s.hi}</p>}
                  <div className="mt-2">{!(mostMissing && p.fallback) && <StatusPill status={p.fallback ? 'missing' : s.status} t={t} />}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <button onClick={() => confused(s.id)} disabled={flagged[s.id]} className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold', flagged[s.id] ? 'bg-sal-100 text-sal-600' : 'bg-madder-100 text-madder-700')}>
                  <HandHelping size={16} />{flagged[s.id] ? '✓ ' : ''}{t('not_understood')}
                </button>
                {canSay && <button onClick={() => say(p)} className="inline-flex items-center gap-1.5 rounded-full bg-sal-800 px-3.5 py-1.5 text-sm font-bold text-white" aria-label={t('listen')}><Volume2 size={16} />{t('listen')}</button>}
              </div>
            </li>
          )
        })}
      </ol>

      <section>
        <h2 className="mb-2 text-xl font-bold text-sal-800">{t('vocab')}</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {l.vocab.map((w) => (
            <li key={w.en}>
              <button onClick={() => canSpeak('hi') && speak(w.hi, 'hi')} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left">
                <span className="text-3xl">{w.emoji}</span>
                <span className="min-w-0">
                  <b className="block font-display text-xl leading-tight text-sal-800" lang={lang}>{lang === 'en' ? w.en : lang === 'hi' ? w.hi : w.status === 'missing' ? w.hi : w.term}</b>
                  <span className="block truncate text-xs text-mist">{[lang !== 'hi' && w.hi, lang !== 'en' && w.en].filter(Boolean).join(' · ')}</span>
                  {w.status === 'draft' && <span className="text-[10px] font-bold text-mahua-600">{t('draft')}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <KidButton tone="gold" className="w-full text-lg" onClick={finish}>{t('take_quiz')}</KidButton>
    </div>
  )
}
