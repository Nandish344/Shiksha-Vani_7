import { useMemo, useRef, useState } from 'react'
import { Mic, Plus, Play, Search, Square } from 'lucide-react'
import * as api from '../../lib/api'
import { useI18n, LANGS, TRIBAL } from '../../lib/i18n'
import { useLoad } from '../../lib/hooks'
import { recordClip } from '../../lib/speech'
import { Chip, Empty, ErrorNote, KidButton, Segmented, Sheet, Skeleton, cx, useToast } from '../../components/ui'

export default function Kosh() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [tab, setTab] = useState(LANGS[lang].tribal ? lang : 'sat')
  const [q, setQ] = useState('')
  const { data, error, loading, reload } = useLoad(`/api/words?lang=${tab}`, [tab])
  const [open, setOpen] = useState(false)
  const list = useMemo(() => (data || []).filter((w) => !q || `${w.term} ${w.meaning_en} ${w.meaning_hi || ''}`.toLowerCase().includes(q.toLowerCase())), [data, q])

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-sal-800">{t('bhasha_kosh')}</h1>
      <Segmented value={tab} onChange={setTab} options={TRIBAL.map((c) => ({ value: c, label: LANGS[c].name }))} className="w-full [&>button]:flex-1 [&>button]:px-1" />
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="field pl-10" aria-label={t('search')} />
      </div>
      <ErrorNote error={error} retry={reload} />
      {loading && <Skeleton className="h-40" />}
      {data && list.length === 0 && <Empty icon="🗣️" title={t('no_words')} />}
      <ul className="grid gap-2.5">
        {list.map((w) => (
          <li key={w.id} className="card flex items-center gap-3 p-3.5">
            <div className="min-w-0 grow">
              <p className="font-display text-2xl font-extrabold leading-tight text-sal-800" lang={w.language}>{w.term}</p>
              <p className="text-sm text-mist">{w.meaning_en}{w.meaning_hi ? ` · ${w.meaning_hi}` : ''}</p>
              {w.by && <p className="text-xs text-mist/80">{w.by}</p>}
            </div>
            <Chip tone={w.status === 'verified' ? 'sal' : 'gold'}>{w.status === 'verified' ? t('verified') : t('draft')}</Chip>
            {w.audio && <button onClick={() => new Audio(w.audio).play()} className="grid h-11 w-11 place-items-center rounded-full bg-sal-800 text-white" aria-label={t('listen')}><Play size={18} fill="currentColor" /></button>}
          </li>
        ))}
      </ul>
      <KidButton tone="gold" className="fixed bottom-28 right-4 z-30 h-14 rounded-full px-5 md:absolute" onClick={() => setOpen(true)}><Plus size={22} />{t('add_word')}</KidButton>
      <AddWord open={open} onClose={() => setOpen(false)} defaultLang={tab} t={t} onSaved={() => { setOpen(false); reload(); toast(t('save') + ' ✓') }} />
    </div>
  )
}

function AddWord({ open, onClose, defaultLang, t, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ language: defaultLang, term: '', meaning_en: '', meaning_hi: '' })
  const [audio, setAudio] = useState(null)
  const [rec, setRec] = useState(null)
  const [busy, setBusy] = useState(false)
  const ctl = useRef(null)

  const record = async () => {
    if (rec) { ctl.current?.stop(); return }
    try {
      ctl.current = await recordClip(5000)
      setRec(true)
      setAudio(await ctl.current.done)
    } catch { toast(t('mic_denied'), 'err') }
    setRec(false)
  }
  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api.post('/api/words', { ...f, language: f.language || defaultLang, audio }); setF({ language: defaultLang, term: '', meaning_en: '', meaning_hi: '' }); setAudio(null); onSaved() }
    catch (err) { toast(err.message, 'err') }
    setBusy(false)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('add_word')}>
      <form onSubmit={save} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-sal-800">{t('word_in')}
          <select className="field" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>{TRIBAL.map((c) => <option key={c} value={c}>{LANGS[c].name}</option>)}</select>
        </label>
        <input className="field text-xl" required placeholder="daru" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} aria-label="Word" />
        <input className="field" required placeholder={t('meaning')} value={f.meaning_en} onChange={(e) => setF({ ...f, meaning_en: e.target.value })} />
        <input className="field" placeholder={t('meaning_hi')} value={f.meaning_hi} onChange={(e) => setF({ ...f, meaning_hi: e.target.value })} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={record} className={cx('btn gap-2', rec ? 'btn-danger' : 'btn-soft')}>{rec ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}{rec ? t('stop') : t('record')}</button>
          {audio && !rec && <audio controls src={audio} className="h-10 min-w-0 grow" />}
        </div>
        <div className="mt-1 flex gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button><button className="btn btn-primary grow" disabled={busy}>{t('save')}</button></div>
      </form>
    </Sheet>
  )
}
