import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, CloudDownload, Loader2 } from 'lucide-react'
import * as api from '../../lib/api'
import { markDownloaded, readDownloads } from '../../lib/store'
import { useI18n } from '../../lib/i18n'
import { useLoad } from '../../lib/hooks'
import { useNet } from '../../lib/session'
import { Chip, ErrorNote, Skeleton, cx, useToast } from '../../components/ui'

export default function Lessons() {
  const { t, lang } = useI18n()
  const { online } = useNet()
  const toast = useToast()
  const { data, error, loading, reload } = useLoad('/api/lessons', [lang])
  const [subject, setSubject] = useState('all')
  const [saved, setSaved] = useState([])
  const [busy, setBusy] = useState(null)
  useEffect(() => { readDownloads().then(setSaved) }, [])

  const subjects = useMemo(() => ['all', ...new Set((data || []).map((l) => l.subject))], [data])
  const list = (data || []).filter((l) => subject === 'all' || l.subject === subject)

  const save = async (l) => {
    setBusy(l.id)
    try {
      await api.get(`/api/lessons/${l.id}?lang=${lang}`)
      await markDownloaded(l.id, lang)
      setSaved(await readDownloads())
      toast(t('saved_offline'))
    } catch (e) { toast(e.message, 'err') }
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-sal-800">{t('lessons')}</h1>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {subjects.map((s) => (
          <button key={s} onClick={() => setSubject(s)} className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-bold', subject === s ? 'bg-sal-800 text-white' : 'bg-white text-sal-800 ring-1 ring-line')}>{s === 'all' ? t('all') : s}</button>
        ))}
      </div>
      <ErrorNote error={error} retry={reload} />
      {loading && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      <ul className="grid gap-3">
        {list.map((l) => {
          const isSaved = saved.includes(`${l.id}:${lang}`)
          return (
            <li key={l.id} className="card flex items-center gap-3 p-3">
              <Link to={`/student/lesson/${l.id}`} className="flex min-w-0 grow items-center gap-3">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-sal-50 text-4xl">{l.emoji}</span>
                <span className="min-w-0">
                  <b className="block font-display text-lg leading-tight text-sal-800" lang={lang}>{l.title}</b>
                  {lang !== 'hi' && l.title_hi !== l.title && <span className="block truncate text-sm text-mist">{l.title_hi}</span>}
                  <span className="mt-1 flex gap-1.5"><Chip tone="sal">{l.subject}</Chip><Chip tone="grey">{t('grade')} {l.grade}</Chip><Chip tone="grey">{l.minutes} {t('minutes')}</Chip></span>
                </span>
              </Link>
              <button onClick={() => !isSaved && save(l)} disabled={!online && !isSaved} aria-label={isSaved ? t('saved_offline') : t('save_offline')}
                className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-full', isSaved ? 'bg-sal-100 text-sal-600' : 'bg-mahua-100 text-mahua-700 disabled:opacity-40')}>
                {busy === l.id ? <Loader2 className="animate-spin" size={22} /> : isSaved ? <CheckCircle2 size={24} /> : <CloudDownload size={24} />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
