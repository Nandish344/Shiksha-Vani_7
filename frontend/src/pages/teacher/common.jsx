import { cx } from '../../components/ui'
import { LANGS } from '../../lib/i18n'

export function PageHead({ title, sub, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-extrabold text-sal-800 sm:text-4xl">{title}</h1>{sub && <p className="mt-1 text-mist">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  )
}

export function Panel({ title, action, className, children }) {
  return (
    <section className={cx('card p-5', className)}>
      {(title || action) && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-sal-800">{title}</h2>{action}</div>}
      {children}
    </section>
  )
}

export const SEV = {
  high: { dot: 'bg-madder-500', chip: 'red', label: 'Urgent' },
  medium: { dot: 'bg-mahua-400', chip: 'gold', label: 'Watch' },
  low: { dot: 'bg-river-500', chip: 'blue', label: 'Note' },
}

export const langName = (c) => LANGS[c]?.name || c
export const pctColor = (v) => (v == null ? 'text-mist' : v >= 75 ? 'text-sal-600' : v >= 60 ? 'text-mahua-600' : 'text-madder-600')
export const ago = (iso) => {
  if (!iso) return 'never'
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}
