import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { LANGS } from '../lib/i18n'

export const cx = (...a) => a.filter(Boolean).join(' ')

/* ---------------------------------------------------------------- buttons */
const KID = {
  green: 'bg-sal-500 text-white [--press:#0E3B32] hover:brightness-105',
  gold: 'bg-mahua-400 text-sal-900 [--press:#8A5F0B] hover:brightness-105',
  red: 'bg-madder-500 text-white [--press:#832A1C] hover:brightness-105',
  white: 'bg-white text-sal-800 border-2 border-sal-200 [--press:#B9D7C8]',
  dark: 'bg-sal-800 text-white [--press:#092A24]',
}
export function KidButton({ tone = 'green', className, ...p }) {
  return <button className={cx('kid-btn', KID[tone], className)} {...p} />
}
export function Button({ variant = 'primary', className, ...p }) {
  return <button className={cx('btn', `btn-${variant}`, className)} {...p} />
}

/* ---------------------------------------------------------------- small pieces */
export function Chip({ tone = 'sal', className, children, ...p }) {
  const t = {
    sal: 'bg-sal-100 text-sal-800', gold: 'bg-mahua-100 text-mahua-700', red: 'bg-madder-100 text-madder-700',
    blue: 'bg-river-100 text-river-700', grey: 'bg-slate-100 text-slate-600', dark: 'bg-sal-800 text-white',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', t, className)} {...p}>{children}</span>
}

export function LangChip({ code, native = false, className }) {
  const l = LANGS[code]
  return <Chip tone="gold" className={className}>{native ? l?.native : l?.name || code}</Chip>
}

export function Avatar({ emoji, size = 40, className }) {
  return <span className={cx('inline-grid place-items-center rounded-full bg-sal-100 ring-2 ring-white', className)} style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden>{emoji || '🙂'}</span>
}

export function Progress({ value, tone, className }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const c = tone || (v >= 75 ? 'bg-sal-500' : v >= 60 ? 'bg-mahua-400' : 'bg-madder-500')
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-sal-100', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', c)} style={{ width: `${v}%` }} />
    </div>
  )
}

export function Skeleton({ className }) { return <div className={cx('skeleton', className)} /> }
export function Spinner({ className }) { return <Loader2 className={cx('animate-spin', className)} size={20} aria-label="Loading" /> }

export function Empty({ icon = '🌱', title, children, action }) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-sal-200 bg-white/60 px-6 py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="font-display text-lg font-bold text-sal-800">{title}</p>
      {children && <p className="max-w-sm text-sm text-mist">{children}</p>}
      {action}
    </div>
  )
}

export function ErrorNote({ error, retry }) {
  if (!error) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-madder-100 bg-madder-50 p-4 text-sm text-madder-700" role="alert">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="grow">{error.message || String(error)}</div>
      {retry && <button className="font-semibold underline" onClick={retry}>Retry</button>}
    </div>
  )
}

export function Segmented({ value, onChange, options, className }) {
  return (
    <div className={cx('inline-flex rounded-2xl bg-sal-100 p-1', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors', value === o.value ? 'bg-white text-sal-800 shadow-sm' : 'text-sal-700/70 hover:text-sal-800')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- sheet / modal */
export function Sheet({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sal-900/50 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={cx('rise max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-bold text-sal-800">{title}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sal-100" aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- toasts */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random()
    setItems((s) => [...s, { id, text, tone }])
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={cx('pop pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-xl', i.tone === 'err' ? 'bg-madder-600' : 'bg-sal-800')}>
            {i.tone === 'err' ? <AlertTriangle size={16} /> : <Check size={16} />} {i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------------------------------------------------------- brand */
export function Logo({ size = 36, dark = false, text = true }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="16" fill={dark ? '#F2B035' : '#0E3B32'} />
        <path d="M12 14h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H31l-11 9v-9h-8a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6Z" transform="translate(-3 0)" fill={dark ? '#0E3B32' : '#F2B035'} />
        <path d="M21 37c0-9 6-15 18-15 0 10-6 16-15 16-1 0-2 0-3-1Z" fill={dark ? '#F2B035' : '#0E3B32'} />
      </svg>
      {text && (
        <span className="leading-none">
          <span className={cx('block font-display text-xl font-extrabold', dark ? 'text-white' : 'text-sal-800')}>Shiksha Vani</span>
          <span className={cx('block text-[11px] font-semibold', dark ? 'text-mahua-300' : 'text-mahua-600')}>शिक्षा वाणी</span>
        </span>
      )}
    </span>
  )
}

export function StatusPill({ status, t }) {
  if (status === 'verified' || status === 'source' || status === 'same') return null
  if (status === 'missing') return <Chip tone="grey">{t('missing_note')}</Chip>
  return <Chip tone="gold">{t('draft')}</Chip>
}
