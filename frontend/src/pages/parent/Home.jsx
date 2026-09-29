import { useState } from 'react'
import { Flame, Star, Send, Volume2, Lightbulb, MessageSquareText } from 'lucide-react'
import * as api from '../../lib/api'
import { useAuth } from '../../lib/session'
import { useI18n, LANGS, uiLang } from '../../lib/i18n'
import { useLoad } from '../../lib/hooks'
import { canSpeak, speak } from '../../lib/speech'
import { Avatar, Chip, Empty, ErrorNote, Progress, Segmented, Skeleton, cx, useToast } from '../../components/ui'

const STATUS = {
  good: { key: 'doing_good', tile: 'bg-white/12', bg: 'bg-sal-800 text-white', emoji: '😊' },
  ok: { key: 'doing_ok', tile: 'bg-white/12', bg: 'bg-sal-700 text-white', emoji: '🙂' },
  help: { key: 'doing_help', tile: 'bg-white/45', bg: 'bg-mahua-300 text-sal-900', emoji: '🤝' },
}
const LINE_DOT = { good: 'bg-sal-500', ok: 'bg-mahua-400', help: 'bg-madder-500' }

export default function ParentHome() {
  const { user, setLanguage } = useAuth()
  const { t, lang } = useI18n()
  const [tab, setTab] = useState('report')
  const { data, error, loading, reload } = useLoad('/api/parent/children', [lang])
  const kid = data?.[0]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" aria-label={t('language')}>
        {['sat', 'unr', 'hoc', 'kru', 'hi', 'en'].map((c) => (
          <button key={c} onClick={() => setLanguage(c)} aria-pressed={lang === c} lang={c} className={cx('rounded-full px-3 py-1 text-sm font-bold', lang === c ? 'bg-sal-800 text-white' : 'bg-white text-sal-800 ring-1 ring-line')}>{LANGS[c].native}</button>
        ))}
      </div>
      <ErrorNote error={error} retry={reload} />
      {loading && <div className="space-y-3"><Skeleton className="h-44" /><Skeleton className="h-32" /></div>}
      {data && !kid && <Empty icon="👨‍👩‍👧" title="No child linked yet">Ask the school to link your account to your child.</Empty>}
      {kid && (
        <>
          <Hero kid={kid} t={t} lang={lang} />
          <Segmented value={tab} onChange={setTab} options={[{ value: 'report', label: t('report') }, { value: 'messages', label: t('messages') }]} className="w-full [&>button]:flex-1" />
          {tab === 'report' ? <Report kid={kid} t={t} /> : <Messages kid={kid} t={t} lang={lang} user={user} />}
        </>
      )}
    </div>
  )
}

function Hero({ kid, t, lang }) {
  const r = kid.report, st = STATUS[r.status], first = r.student.name.split(' ')[0]
  return (
    <section className={cx('rise rounded-hero p-5', st.bg)}>
      <div className="flex items-center gap-4">
        <Avatar emoji={r.student.avatar} size={64} />
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold leading-tight" lang={uiLang(lang)}>{first} {t(st.key)} <span aria-hidden>{st.emoji}</span></h1>
          <p className="text-sm opacity-80">{t('grade')} {r.student.grade} · {r.student.village}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
        <div className={cx('rounded-2xl px-2 py-2.5', st.tile)}><p className="font-display text-3xl font-extrabold">{r.numbers.comprehension ?? '–'}<span className="text-base">%</span></p><p className="text-[11px] font-semibold opacity-80">{t('comprehension')}</p></div>
        <div className={cx('rounded-2xl px-2 py-2.5', st.tile)}><p className="font-display text-3xl font-extrabold">{r.numbers.pronunciation ?? '–'}<span className="text-base">%</span></p><p className="text-[11px] font-semibold opacity-80">{t('reading')}</p></div>
        <div className={cx('rounded-2xl px-2 py-2.5', st.tile)}><p className="flex items-center justify-center gap-1 font-display text-3xl font-extrabold"><Flame size={22} className="text-mahua-300" />{r.numbers.streak}</p><p className="text-[11px] font-semibold opacity-80">{t('day_streak')}</p></div>
      </div>
    </section>
  )
}

function Report({ kid, t }) {
  const r = kid.report
  const readAloud = () => {
    const first = r.lines.find((l) => canSpeak(l.lang))
    if (!first) return
    // speak() cancels earlier speech, so read all lines in the first line's language as one passage.
    speak(r.lines.filter((l) => l.lang === first.lang).map((l) => l.text).join(' '), first.lang)
  }
  const speakable = r.lines.some((l) => canSpeak(l.lang))
  const subjects = Object.entries(r.subjects).filter(([, v]) => v != null)
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-sal-800">{t('report')}</h2>
          {speakable && <button onClick={readAloud} className="inline-flex items-center gap-1.5 rounded-full bg-sal-800 px-3.5 py-1.5 text-sm font-bold text-white"><Volume2 size={16} />{t('listen_report')}</button>}
        </div>
        {r.lines.some((l) => !l.translated) && <Chip tone="grey" className="mb-3">{t('in_hindi')}</Chip>}
        <ul className="space-y-3">
          {r.lines.map((l) => (
            <li key={l.key} className="flex gap-3">
              <span className={cx('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', LINE_DOT[l.status] || 'bg-sal-300')} />
              <p className="text-lg leading-snug" lang={l.lang}>{l.text}</p>
            </li>
          ))}
        </ul>
      </section>
      {subjects.length > 0 && (
        <section className="card space-y-3 p-4">
          {subjects.map(([k, v]) => (<div key={k}><div className="mb-1 flex justify-between text-sm font-semibold text-sal-800"><span>{k}</span><span>{v}%</span></div><Progress value={v} /></div>))}
        </section>
      )}
      <section className="rounded-2xl bg-mahua-100 p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-mahua-700"><Lightbulb size={20} />{t('tips_home')}</h2>
        <ul className="mt-2 space-y-2">{r.tips.map((l) => <li key={l.key} className="text-lg leading-snug text-sal-900" lang={l.lang}>{l.text}</li>)}</ul>
      </section>
    </div>
  )
}

function Messages({ kid, t, lang, user }) {
  const toast = useToast()
  const { data, reload } = useLoad('/api/parent/messages')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const quick = ['q1', 'q2', 'q3', 'q4']
  const send = async (body, srcLang) => {
    if (!body.trim()) return
    setBusy(true)
    try { await api.post('/api/parent/messages', { student_id: kid.stats.id, text: body.trim(), lang: srcLang }); setText(''); toast(t('delivered')); reload() }
    catch (e) { toast(e.message, 'err') }
    setBusy(false)
  }
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-sal-800"><MessageSquareText size={20} />{t('msg_teacher')}</h2>
        <p className="mt-3 text-sm font-semibold text-mist">{t('quick_msgs')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map((k) => <button key={k} disabled={busy} onClick={() => send(t(k), uiLang(lang))} className="rounded-full bg-sal-100 px-3.5 py-2 text-left text-sm font-semibold text-sal-800 hover:bg-sal-200" lang={uiLang(lang)}>{t(k)}</button>)}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text, lang) }}>
          <input className="field" lang={lang} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('msg_ph')} aria-label={t('msg_ph')} />
          <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label={t('send')}><Send size={18} /></button>
        </form>
      </section>
      {data?.length === 0 && <Empty icon="💬" title={t('no_messages')} />}
      <ul className="space-y-2">
        {data?.map((m) => (
          <li key={m.id} className={cx('flex', m.mine && 'justify-end')}>
            <p className={cx('max-w-[85%] rounded-3xl px-4 py-2.5 text-lg', m.mine ? 'rounded-br-lg bg-mahua-300 text-sal-900' : 'rounded-bl-lg bg-white ring-1 ring-line')}>{m.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
