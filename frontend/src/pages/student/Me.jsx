import { useNavigate } from 'react-router-dom'
import { LogOut, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useAuth, useNet } from '../../lib/session'
import { useI18n, LANGS } from '../../lib/i18n'
import { Avatar, Segmented, cx, useToast } from '../../components/ui'

export default function Me() {
  const { user, logout, setLanguage, prefs, setPref } = useAuth()
  const { t, lang } = useI18n()
  const { online, pending, flush, syncing, lastSync } = useNet()
  const nav = useNavigate()
  const toast = useToast()
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <Avatar emoji={user.avatar} size={72} />
        <div><h1 className="text-3xl font-extrabold text-sal-800">{user.name}</h1><p className="text-mist">{t('grade')} {user.grade} · {user.village}</p></div>
      </header>

      <section className="card p-4">
        <h2 className="text-lg font-bold text-sal-800">{t('language')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {Object.entries(LANGS).map(([c, l]) => (
            <button key={c} onClick={() => setLanguage(c).then(() => toast(l.native + ' ✓'))} aria-pressed={lang === c}
              className={cx('rounded-2xl border-2 px-3 py-2.5 text-left', lang === c ? 'border-sal-500 bg-sal-50' : 'border-line bg-white')}>
              <b className="block font-display text-lg leading-tight text-sal-800" lang={c}>{l.native}</b>
              <span className="text-xs text-mist">{l.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold text-sal-800">{t('text_size')}</span>
          <Segmented value={prefs.scale} onChange={(v) => setPref('scale', v)} options={[{ value: 0.9, label: 'A' }, { value: 1, label: 'A+' }, { value: 1.15, label: 'A++' }]} />
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="font-bold text-sal-800">{t('auto_read')}</span>
          <input type="checkbox" className="h-6 w-6 accent-sal-600" checked={prefs.autoRead} onChange={(e) => setPref('autoRead', e.target.checked)} />
        </label>
      </section>

      <section className="card flex items-center gap-3 p-4">
        {pending === 0 ? <CheckCircle2 className="text-sal-500" /> : <RefreshCw className={syncing ? 'animate-spin text-mahua-600' : 'text-mahua-600'} />}
        <div className="grow">
          <p className="font-bold text-sal-800">{online ? t('online') : t('offline')} · {pending === 0 ? t('synced') : `${pending} ${t('waiting_sync')}`}</p>
          {lastSync && <p className="text-xs text-mist">{lastSync.toLocaleTimeString()}</p>}
        </div>
        {pending > 0 && online && <button className="btn btn-soft" onClick={flush}>{t('sync_now')}</button>}
      </section>

      <button onClick={() => { logout(); nav('/') }} className="btn btn-outline w-full"><LogOut size={16} />{t('logout')}</button>
    </div>
  )
}
