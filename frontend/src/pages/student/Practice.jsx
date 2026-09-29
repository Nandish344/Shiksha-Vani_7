import { useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, SkipForward, Square, Star, Volume2 } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { useLoad } from '../../lib/hooks'
import { useNet } from '../../lib/session'
import { canListen, canSpeak, listen, scoreLocal, speak } from '../../lib/speech'
import { ErrorNote, KidButton, Segmented, Skeleton, cx, useToast } from '../../components/ui'

const WORD = {
  ok: 'bg-sal-100 text-sal-700',
  close: 'bg-mahua-100 text-mahua-700',
  wrong: 'bg-madder-100 text-madder-700 underline decoration-wavy',
  missed: 'bg-madder-100 text-madder-700 underline decoration-wavy',
}

export default function Practice() {
  const { t } = useI18n()
  const { enqueue } = useNet()
  const toast = useToast()
  const [rl, setRl] = useState('hi')
  const { data, error, loading, reload } = useLoad(`/api/practice/sentences?lang=${rl}`, [rl])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState('idle') // idle | listening | result
  const [interim, setInterim] = useState('')
  const [result, setResult] = useState(null)
  const ctl = useRef(null)
  const startedAt = useRef(0)
  const heard = useRef('')

  useEffect(() => () => ctl.current?.stop(), [])
  useEffect(() => { setIdx(0); setPhase('idle'); setResult(null) }, [rl])

  if (loading) return <Skeleton className="h-72" />
  if (error) return <ErrorNote error={error} retry={reload} />
  const s = data[idx % data.length]

  const finish = () => {
    ctl.current?.stop()
    const seconds = (Date.now() - startedAt.current) / 1000
    const r = scoreLocal(s.text, heard.current, seconds)
    setResult(r); setPhase('result')
    enqueue('attempt', { kind: 'practice', lesson_id: s.lesson_id, score: r.score, seconds: Math.round(seconds), detail: { accuracy: r.accuracy } })
  }

  const start = () => {
    if (!canListen()) return toast(t('stt_missing'), 'err')
    heard.current = ''; setInterim(''); setResult(null); setPhase('listening'); startedAt.current = Date.now()
    ctl.current = listen({
      lang: rl, continuous: true,
      onInterim: setInterim,
      onFinal: (txt) => { heard.current = `${heard.current} ${txt}`.trim(); setInterim(heard.current) },
      onError: (e) => { setPhase('idle'); toast(e === 'not-allowed' ? t('mic_denied') : t('stt_missing'), 'err') },
    })
  }

  const next = () => { setIdx((n) => n + 1); setPhase('idle'); setResult(null); setInterim('') }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl font-extrabold text-sal-800">{t('speak_practice')}</h1>
        <Segmented value={rl} onChange={setRl} options={[{ value: 'hi', label: 'हिन्दी' }, { value: 'en', label: 'English' }]} />
      </div>

      <section className="rounded-hero bg-white p-5 shadow-card ring-1 ring-line">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist"><span className="text-xl">{s.emoji}</span>{s.title}</p>
        {phase === 'result' && result ? (
          <p className="text-[28px] font-bold leading-[1.5]" lang={rl}>
            {result.words.map((w, n) => <span key={n} className={cx('mr-1.5 inline-block rounded-lg px-1.5', WORD[w.status])}>{w.word}</span>)}
          </p>
        ) : (
          <p className="text-[28px] font-bold leading-[1.5] text-ink" lang={rl}>{s.text}</p>
        )}
        {canSpeak(rl) && phase !== 'listening' && <button onClick={() => speak(s.text, rl)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sal-100 px-3.5 py-2 text-sm font-bold text-sal-800"><Volume2 size={16} />{t('listen')}</button>}
      </section>

      {phase === 'listening' && (
        <div className="rounded-2xl bg-madder-50 p-4 text-center">
          <p className="font-display text-lg font-bold text-madder-700">{t('listening')}</p>
          <p className="mt-1 min-h-[1.5rem] text-mist" lang={rl}>{interim}</p>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="pop space-y-3 text-center">
          <div className="flex justify-center gap-1.5">{[1, 2, 3].map((n) => <Star key={n} size={44} className={n <= result.stars ? 'fill-mahua-400 text-mahua-500' : 'text-sal-200'} />)}</div>
          <p className="font-display text-5xl font-extrabold text-sal-800">{result.score}<span className="text-2xl">%</span></p>
          <p className="text-sm text-mist">{t('you_said')}: <span lang={rl}>{result.heard || '—'}</span></p>
        </div>
      )}

      <div className="grid gap-3">
        {phase === 'idle' && <KidButton tone="red" className="py-3 text-lg" onClick={start}><Mic size={24} />{t('tap_to_speak')}</KidButton>}
        {phase === 'listening' && <KidButton tone="dark" className="py-3 text-lg" onClick={finish}><Square size={20} fill="currentColor" />{t('stop')}</KidButton>}
        {phase === 'result' && (<>
          <KidButton tone="gold" onClick={start}><RotateCcw size={20} />{t('try_again')}</KidButton>
          <KidButton tone="white" onClick={next}><SkipForward size={20} />{t('new_sentence')}</KidButton>
        </>)}
        {phase === 'idle' && <KidButton tone="white" onClick={next}><SkipForward size={20} />{t('new_sentence')}</KidButton>}
      </div>
      {!canListen() && <p className="rounded-2xl bg-mahua-100 p-3 text-sm text-mahua-700">{t('stt_missing')}</p>}
    </div>
  )
}
