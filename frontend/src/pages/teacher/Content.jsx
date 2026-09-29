import { useEffect, useMemo, useState } from 'react'
import { Check, Save, X, BadgeCheck } from 'lucide-react'
import * as api from '../../lib/api'
import { LANGS, TRIBAL } from '../../lib/i18n'
import { useLoad } from '../../lib/hooks'
import { Button, Chip, Empty, ErrorNote, Progress, Segmented, Skeleton, cx, useToast } from '../../components/ui'
import { PageHead, Panel, langName } from './common'

const SRC_TONE = { seed: 'grey', bhashini: 'blue', public: 'gold', teacher: 'sal' }

export default function Content() {
  const [tab, setTab] = useState('lesson')
  return (
    <div>
      <PageHead title="Content review" sub="AI drafts never become “checked” until a teacher who speaks the language approves them." />
      <Segmented value={tab} onChange={setTab} className="mb-5" options={[{ value: 'lesson', label: 'Translate a lesson' }, { value: 'queue', label: 'Draft queue' }, { value: 'words', label: 'Community words' }]} />
      {tab === 'lesson' && <LessonEditor />}
      {tab === 'queue' && <Queue />}
      {tab === 'words' && <Words />}
    </div>
  )
}

/* -------------------------------------------------- write / fix a whole lesson in one language */
function flatten(l) {
  const rows = [{ key: 't', label: 'Title', hi: l.title_hi, text: l.title, status: l.title_status }]
  l.sections.forEach((s) => rows.push({ key: `s${s.id}`, label: `Line ${s.id}`, hi: s.hi, text: s.text, status: s.status }))
  l.vocab.forEach((v) => rows.push({ key: `v${v.en}`, label: `Word: ${v.en}`, hi: v.hi, text: v.term, status: v.status }))
  l.quiz.forEach((q) => {
    rows.push({ key: `q${q.id}`, label: `Question ${q.id}`, hi: q.q_hi, text: q.q, status: q.status })
    q.options.forEach((o, i) => rows.push({ key: `q${q.id}o${i}`, label: `  Option ${String.fromCharCode(65 + i)}`, hi: o.hi, text: o.text, status: o.status }))
  })
  return rows
}

function LessonEditor() {
  const toast = useToast()
  const { data: lessons } = useLoad('/api/lessons')
  const [lid, setLid] = useState(null)
  const [lang, setLang] = useState('sat')
  const [rows, setRows] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [err, setErr] = useState(null)
  useEffect(() => { if (lessons && !lid) setLid(lessons[0]?.id) }, [lessons, lid])
  const load = async () => { if (!lid) return; setRows(null); try { setRows(flatten(await api.get(`/api/lessons/${lid}?lang=${lang}`, { cacheIt: false }))); setDrafts({}) } catch (e) { setErr(e) } }
  useEffect(() => { load() }, [lid, lang]) // eslint-disable-line

  const verified = rows ? Math.round((rows.filter((r) => r.status === 'verified').length / rows.length) * 100) : 0
  const save = async (r, val) => {
    try { await api.post('/api/teacher/translations', { src: 'hi', tgt: lang, text: r.hi, translation: val }); toast('Saved and checked ✓'); setRows((all) => all.map((x) => (x.key === r.key ? { ...x, text: val, status: 'verified' } : x))); setDrafts((d) => { const n = { ...d }; delete n[r.key]; return n }) }
    catch (e) { toast(e.message, 'err') }
  }
  const approve = (r) => save(r, r.text)

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="grid gap-1 text-sm font-semibold text-sal-800">Lesson
          <select className="field min-w-[220px]" value={lid || ''} onChange={(e) => setLid(Number(e.target.value))}>{lessons?.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.title_en}</option>)}</select>
        </label>
        <div className="grid gap-1 text-sm font-semibold text-sal-800">Language<Segmented value={lang} onChange={setLang} options={TRIBAL.map((c) => ({ value: c, label: LANGS[c].name }))} /></div>
        {rows && <div className="ml-auto w-56"><div className="mb-1 flex justify-between text-sm font-semibold text-sal-800"><span>Checked</span><span>{verified}%</span></div><Progress value={verified} tone="bg-sal-500" /></div>}
      </div>
      <p className="mb-4 rounded-xl bg-sal-50 p-3 text-sm text-sal-800">Type the {langName(lang)} version next to each Hindi line, or approve a draft that is already right. Every saved line is remembered for all future lessons and works offline.</p>
      <ErrorNote error={err} />
      {!rows ? <Skeleton className="h-64" /> : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const val = drafts[r.key] ?? (r.status === 'missing' ? '' : r.text)
            const dirty = drafts[r.key] !== undefined && drafts[r.key] !== r.text
            return (
              <li key={r.key} className="grid gap-2 py-3 md:grid-cols-[1fr_1.3fr_auto] md:items-center">
                <div><p className="text-xs font-semibold text-mist">{r.label}</p><p className="text-base text-ink" lang="hi">{r.hi}</p></div>
                <input className="field" lang={lang} value={val} placeholder={`${langName(lang)}…`} onChange={(e) => setDrafts((d) => ({ ...d, [r.key]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && val.trim() && save(r, val.trim())} />
                <div className="flex items-center gap-2 md:w-44 md:justify-end">
                  {r.status === 'verified' && !dirty ? <Chip tone="sal"><BadgeCheck size={14} />checked</Chip> : <>
                    {r.status === 'draft' && !dirty && <Button variant="soft" className="!min-h-9" onClick={() => approve(r)}><Check size={15} />Approve</Button>}
                    <Button className="!min-h-9" disabled={!val.trim()} onClick={() => save(r, val.trim())}><Save size={15} />Save</Button>
                  </>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------- draft queue */
function Queue() {
  const toast = useToast()
  const [lang, setLang] = useState('sat')
  const { data, error, loading, reload } = useLoad(`/api/teacher/review?status=draft&lang=${lang}&limit=80`, [lang])
  const [edits, setEdits] = useState({})
  const [gone, setGone] = useState(new Set())
  const act = async (item, action, text) => {
    try { await api.post(`/api/teacher/review/${item.id}`, { action, text }); setGone((g) => new Set(g).add(item.id)); toast(action === 'reject' ? 'Rejected' : 'Checked ✓') }
    catch (e) { toast(e.message, 'err') }
  }
  const items = useMemo(() => (data?.items || []).filter((i) => !gone.has(i.id)), [data, gone])
  return (
    <Panel title="Drafts waiting for a native speaker" action={<Segmented value={lang} onChange={(v) => { setLang(v); setGone(new Set()) }} options={TRIBAL.map((c) => ({ value: c, label: LANGS[c].name }))} />}>
      <ErrorNote error={error} retry={reload} />
      {loading && <Skeleton className="h-48" />}
      {data && items.length === 0 && <Empty icon="✅" title={`No ${langName(lang)} drafts left`}>New machine translations will appear here for checking.</Empty>}
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="grid gap-2 py-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
            <p className="text-base" lang={i.src_lang}><Chip tone="grey" className="mr-2">{i.src_lang}</Chip>{i.src}</p>
            <input className="field" lang={i.tgt_lang} value={edits[i.id] ?? i.tgt} onChange={(e) => setEdits({ ...edits, [i.id]: e.target.value })} aria-label={`${langName(i.tgt_lang)} translation of ${i.src}`} />
            <div className="flex items-center gap-1.5">
              <Chip tone={SRC_TONE[i.source] || 'grey'}>{i.source}</Chip>
              {edits[i.id] !== undefined && edits[i.id] !== i.tgt
                ? <Button className="!min-h-9" onClick={() => act(i, 'edit', edits[i.id])}><Save size={15} />Save</Button>
                : <Button variant="soft" className="!min-h-9" onClick={() => act(i, 'approve')}><Check size={15} />Approve</Button>}
              <button className="grid h-9 w-9 place-items-center rounded-lg text-madder-600 hover:bg-madder-50" aria-label="Reject" onClick={() => act(i, 'reject')}><X size={18} /></button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* -------------------------------------------------- community dictionary */
function Words() {
  const toast = useToast()
  const [lang, setLang] = useState('sat')
  const { data, error, loading, reload } = useLoad(`/api/words?lang=${lang}`, [lang])
  const verify = async (w) => { try { await api.post(`/api/words/${w.id}/verify`); toast('Word checked ✓'); reload() } catch (e) { toast(e.message, 'err') } }
  const pending = (data || []).filter((w) => w.status !== 'verified')
  return (
    <Panel title="Bhasha Kosh: words added by the community" action={<Segmented value={lang} onChange={setLang} options={TRIBAL.map((c) => ({ value: c, label: LANGS[c].name }))} />}>
      <ErrorNote error={error} retry={reload} />
      {loading && <Skeleton className="h-48" />}
      <p className="mb-3 text-sm text-mist">{data ? `${data.length - pending.length} checked · ${pending.length} waiting` : ''}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {(data || []).map((w) => (
          <li key={w.id} className={cx('flex items-center gap-3 rounded-xl p-3 ring-1', w.status === 'verified' ? 'bg-white ring-line' : 'bg-mahua-100/60 ring-mahua-200')}>
            <div className="min-w-0 grow"><p className="font-display text-xl font-bold text-sal-800" lang={w.language}>{w.term}</p><p className="truncate text-sm text-mist">{w.meaning_en}{w.meaning_hi ? ` · ${w.meaning_hi}` : ''}{w.by ? ` · ${w.by}` : ''}</p></div>
            {w.audio && <audio controls src={w.audio} className="h-8 w-32" />}
            {w.status === 'verified' ? <Chip tone="sal"><BadgeCheck size={13} />checked</Chip> : <Button variant="soft" className="!min-h-9" onClick={() => verify(w)}><Check size={15} />Approve</Button>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
