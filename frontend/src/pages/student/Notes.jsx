import { useI18n } from '../../lib/i18n'
import { useLoad } from '../../lib/hooks'
import { Chip, Empty, ErrorNote, Skeleton } from '../../components/ui'

export default function Notes() {
  const { t, lang } = useI18n()
  const { data, error, loading, reload } = useLoad('/api/student/recaps', [lang])
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-sal-800">{t('notes')}</h1>
      <ErrorNote error={error} retry={reload} />
      {loading && <Skeleton className="h-48" />}
      {data?.length === 0 && <Empty icon="📓" title={t('no_notes')} />}
      {data?.map((s) => (
        <article key={s.id} className="card p-4">
          <h2 className="text-xl font-bold text-sal-800">{s.title}</h2>
          <p className="mb-3 text-sm text-mist">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          <ul className="space-y-2">
            {s.lines.map((l, n) => (
              <li key={n} className="rounded-xl bg-sal-50 px-3 py-2">
                <p className="text-lg" lang={l.status === 'missing' ? 'hi' : lang}>{l.text}</p>
                {l.status === 'missing' && <Chip tone="grey" className="mt-1">{t('missing_note')}</Chip>}
                {l.status === 'draft' && <Chip tone="gold" className="mt-1">{t('draft')}</Chip>}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}
