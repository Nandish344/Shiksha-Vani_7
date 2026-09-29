import { Link, useNavigate } from 'react-router-dom'
import { Flame, Star, BookCheck, Radio, MessageCircle, Mic, Languages, NotebookText, Play, Volume2 } from 'lucide-react'
import { useAuth } from '../../lib/session'
import { useI18n, LANGS } from '../../lib/i18n'
import { useLoad, weekday } from '../../lib/hooks'
import { speak, canSpeak } from '../../lib/speech'
import { Chip, ErrorNote, Skeleton, KidButton, cx } from '../../components/ui'

const Tile = ({ icon: Icon, value, label, tone }) => (
  <div className={cx('rounded-2xl px-3 py-2.5', tone)}>
    <Icon size={20} />
    <p className="mt-1 font-display text-2xl font-extrabold leading-none">{value}</p>
    <p className="mt-0.5 text-[11px] font-semibold opacity-80">{label}</p>
  </div>
)

export default function Home() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const { data, error, loading, reload } = useLoad('/api/student/home', [lang])

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-28" /><Skeleton className="h-44" /></div>
  if (error) return <ErrorNote error={error} retry={reload} />
  const { stats, recommendations: recs, live, word_of_day: word, week } = data
  const first = recs[0]
  const rest = recs.slice(1)

  return (
    <div className="space-y-5">
      <section className="rise">
        <p className="text-sm font-semibold text-mahua-600">{LANGS[lang].native}</p>
        <h1 className="text-[32px] font-extrabold leading-tight text-sal-800" lang={lang}>{LANGS[lang].greet}, {user.name.split(' ')[0]}!</h1>
      </section>

      <section className="grid grid-cols-3 gap-2.5" aria-label="Progress">
        <Tile icon={Flame} value={stats.streak} label={t('day_streak')} tone="bg-madder-100 text-madder-700" />
        <Tile icon={Star} value={stats.stars} label={t('stars')} tone="bg-mahua-100 text-mahua-700" />
        <Tile icon={BookCheck} value={stats.lessons_done} label={t('lessons_done')} tone="bg-sal-100 text-sal-700" />
      </section>

      {live.length > 0 && (
        <button onClick={() => nav(`/student/live/${live[0].code}`)} className="flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-madder-500 p-3.5 text-left text-white shadow-lg">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/20"><Radio className="pulse-ring rounded-full" /></span>
          <span className="grow"><b className="block font-display text-lg leading-tight">{t('live_now')}</b><span className="text-sm text-white/85">{live[0].title} · {live[0].teacher}</span></span>
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-madder-600">{t('join')}</span>
        </button>
      )}

      {first && (
        <section className="rounded-hero bg-sal-800 p-4 text-white">
          <div className="flex items-center justify-between"><h2 className="text-base font-bold text-mahua-300">{t('today_for_you')}</h2><Chip tone="gold">{t(first.reason === 'retry' ? 'retry' : first.reason === 'quiz' ? 'quiz_it' : 'new_for_you')}</Chip></div>
          <div className="mt-3 flex items-center gap-4">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-white/10 text-5xl">{first.lesson.emoji}</span>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-tight" lang={lang}>{first.lesson.title}</p>
              {lang !== 'hi' && first.lesson.title_hi !== first.lesson.title && <p className="text-sm text-sal-200">{first.lesson.title_hi}</p>}
            </div>
          </div>
          <KidButton tone="gold" className="mt-4 w-full text-lg" onClick={() => nav(`/student/lesson/${first.lesson_id}`)}><Play size={20} fill="currentColor" /> {t('start')}</KidButton>
        </section>
      )}

      {rest.length > 0 && (
        <ul className="grid gap-2">
          {rest.map((r) => (
            <li key={r.lesson_id}>
              <Link to={`/student/lesson/${r.lesson_id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                <span className="text-3xl">{r.lesson.emoji}</span>
                <span className="min-w-0 grow"><b className="block truncate font-display text-base text-sal-800" lang={lang}>{r.lesson.title}</b><span className="text-xs text-mist">{r.lesson.minutes} {t('minutes')}</span></span>
                <Chip tone={r.reason === 'retry' ? 'gold' : 'sal'}>{t(r.reason === 'retry' ? 'retry' : r.reason === 'quiz' ? 'quiz_it' : 'new_for_you')}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="card p-4" aria-label={t('this_week')}>
        <h2 className="text-base font-bold text-sal-800">{t('this_week')}</h2>
        <ol className="mt-3 flex justify-between">
          {week.map((d) => (
            <li key={d.date} className="grid justify-items-center gap-1">
              <span className={cx('grid h-9 w-9 place-items-center rounded-full text-base', d.active ? 'bg-mahua-400 text-sal-900' : 'bg-sal-100 text-sal-300')}>{d.active ? '★' : '·'}</span>
              <span className="text-[11px] font-semibold text-mist">{weekday(d.date, lang)}</span>
            </li>
          ))}
        </ol>
      </section>

      {word && (
        <section className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-mahua-300 bg-mahua-100/50 p-4">
          <div className="grow">
            <p className="text-sm font-semibold text-mahua-700">{t('word_of_day')} · {LANGS[lang].name}</p>
            <p className="font-display text-4xl font-extrabold text-sal-800" lang={lang}>{word.term}</p>
            <p className="text-sm text-mist">{word.meaning_en}{word.meaning_hi ? ` · ${word.meaning_hi}` : ''}</p>
          </div>
          {canSpeak('hi') && word.meaning_hi && <button className="grid h-12 w-12 place-items-center rounded-full bg-white text-sal-700 shadow" aria-label={t('listen')} onClick={() => speak(word.meaning_hi, 'hi')}><Volume2 /></button>}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        {[
          { to: '/student/ask', icon: MessageCircle, label: t('ask_tutor'), tone: 'bg-river-100 text-river-700' },
          { to: '/student/speak', icon: Mic, label: t('speak_practice'), tone: 'bg-madder-100 text-madder-700' },
          { to: '/student/kosh', icon: Languages, label: t('bhasha_kosh'), tone: 'bg-sal-100 text-sal-700' },
          { to: '/student/notes', icon: NotebookText, label: t('notes'), tone: 'bg-mahua-100 text-mahua-700' },
        ].map(({ to, icon: Icon, label, tone }) => (
          <Link key={to} to={to} className={cx('flex min-h-[92px] flex-col justify-between rounded-2xl p-3.5 font-display text-[17px] font-bold leading-tight', tone)}>
            <Icon size={26} />{label}
          </Link>
        ))}
      </section>
    </div>
  )
}
