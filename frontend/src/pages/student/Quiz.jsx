import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, X, Star } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { useLoad, pick } from '../../lib/hooks'
import { useNet } from '../../lib/session'
import { ErrorNote, KidButton, Progress, Skeleton, cx } from '../../components/ui'

export default function Quiz() {
  const { id } = useParams()
  const { t, lang } = useI18n()
  const { enqueue } = useNet()
  const nav = useNavigate()
  const { data: l, error, loading, reload } = useLoad(`/api/lessons/${id}?lang=${lang}`, [lang])
  const [i, setI] = useState(0)
  const [sel, setSel] = useState(null)
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const started = useRef(Date.now())
  useEffect(() => { started.current = Date.now() }, [])

  const q = l?.quiz[i]
  const total = l?.quiz.length || 0
  const score = total ? Math.round((correct / total) * 100) : 0
  const stars = score >= 90 ? 3 : score >= 60 ? 2 : 1
  const qText = useMemo(() => (q ? pick({ text: q.q, en: q.q_en, hi: q.q_hi, status: q.status }, 'own', lang) : null), [q, lang])

  if (loading) return <Skeleton className="h-72" />
  if (error) return <ErrorNote error={error} retry={reload} />

  const check = () => {
    setChecked(true)
    if (sel === q.answer) setCorrect((c) => c + 1)
  }
  const next = () => {
    if (i + 1 < total) { setI(i + 1); setSel(null); setChecked(false); return }
    const finalScore = Math.round(((correct) / total) * 100)
    enqueue('attempt', { kind: 'quiz', lesson_id: Number(id), score: finalScore, seconds: Math.round((Date.now() - started.current) / 1000) })
    setDone(true)
  }
  const again = () => { setI(0); setSel(null); setChecked(false); setCorrect(0); setDone(false); started.current = Date.now() }

  if (done) {
    return (
      <div className="grid gap-5 pt-6 text-center">
        <div className="flex justify-center gap-2" aria-label={`${stars} stars`}>
          {[1, 2, 3].map((s) => <Star key={s} size={64} className={cx('pop', s <= stars ? 'fill-mahua-400 text-mahua-500' : 'text-sal-200')} style={{ animationDelay: `${s * 160}ms` }} />)}
        </div>
        <h1 className="text-4xl font-extrabold text-sal-800">{score >= 60 ? t('great_job') : t('keep_going')}</h1>
        <p className="text-mist">{t('your_score')}</p>
        <p className="font-display text-7xl font-extrabold text-sal-800">{score}<span className="text-3xl">%</span></p>
        <div className="grid gap-3">
          <KidButton tone="gold" onClick={again} className="text-lg">{t('try_again')}</KidButton>
          <KidButton tone="white" onClick={() => nav('/student/lessons')} className="text-lg">{t('back_lessons')}</KidButton>
        </div>
      </div>
    )
  }

  const ok = checked && sel === q.answer
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to={`/student/lesson/${id}`} className="grid h-10 w-10 place-items-center rounded-full bg-white text-sal-700 ring-1 ring-line" aria-label="Close"><X size={20} /></Link>
        <Progress value={((i + (checked ? 1 : 0)) / total) * 100} className="h-3 grow" tone="bg-mahua-400" />
        <span className="font-display text-sm font-bold text-sal-700">{i + 1}/{total}</span>
      </div>

      <h1 className="text-[26px] font-extrabold leading-snug text-sal-800" lang={qText.tts}>{qText.text}</h1>
      {lang !== 'hi' && lang !== 'en' && q.q_hi !== qText.text && <p className="-mt-3 text-mist">{q.q_hi}</p>}

      <ul className="grid gap-3">
        {q.options.map((o, n) => {
          const p = pick({ ...o, text: o.text, status: o.status }, 'own', lang)
          const isSel = sel === n, isAns = n === q.answer
          const tone = !checked ? (isSel ? 'bg-mahua-300 text-sal-900 [--press:#8A5F0B]' : 'bg-white text-sal-800 border-2 border-sal-200 [--press:#B9D7C8]')
            : isAns ? 'bg-sal-500 text-white [--press:#0E3B32]' : isSel ? 'bg-madder-500 text-white [--press:#832A1C]' : 'bg-white text-sal-800/50 border-2 border-sal-100 [--press:#DCEBE3]'
          return (
            <li key={n}>
              <button disabled={checked} onClick={() => setSel(n)} className={cx('kid-btn w-full justify-start gap-3 py-3 text-left text-xl', tone, checked && isAns && 'pop')}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/10 text-base">{checked && isAns ? <Check size={18} /> : checked && isSel ? <X size={18} /> : String.fromCharCode(65 + n)}</span>
                <span><span lang={p.tts}>{p.text}</span>{lang !== 'hi' && lang !== 'en' && o.hi !== p.text && <span className="block text-sm font-medium opacity-70">{o.hi}</span>}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {checked && (
        <p className={cx('pop rounded-2xl p-3 text-center font-display text-xl font-bold', ok ? 'bg-sal-100 text-sal-700' : 'bg-madder-100 text-madder-700')} role="status">
          {ok ? t('correct') : t('not_quite')}
        </p>
      )}
      <KidButton tone={checked ? 'green' : 'gold'} className="w-full text-lg" disabled={!checked && sel == null} onClick={checked ? next : check}>
        {checked ? (i + 1 < total ? t('next') : t('finish')) : t('check')}
      </KidButton>
    </div>
  )
}
