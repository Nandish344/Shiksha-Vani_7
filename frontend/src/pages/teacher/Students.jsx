import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileText, Flame, Search, Send, Star } from 'lucide-react'
import * as api from '../../lib/api'
import { LANGS, TRIBAL } from '../../lib/i18n'
import { useLoad } from '../../lib/hooks'
import { Avatar, Button, Chip, ErrorNote, Progress, Sheet, Skeleton, cx, useToast } from '../../components/ui'
import { PageHead, Panel, SEV, ago, langName, pctColor } from './common'

export default function Students() {
  const [params, setParams] = useSearchParams()
  const { data: o, error, loading, reload } = useLoad('/api/teacher/overview')
  const [q, setQ] = useState('')
  const [lang, setLang] = useState('all')
  const [risk, setRisk] = useState(false)
  const openId = Number(params.get('open')) || null
  const flagged = useMemo(() => new Set((o?.alerts || []).filter((a) => a.severity !== 'low').map((a) => a.student_id)), [o])
  const rows = useMemo(() => (o?.students || []).filter((s) => (lang === 'all' || s.language === lang) && (!risk || flagged.has(s.id)) && s.name.toLowerCase().includes(q.toLowerCase())), [o, q, lang, risk, flagged])

  return (
    <div>
      <PageHead title="Students" sub={o ? `${rows.length} of ${o.kpis.students} children` : ' '} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] grow sm:grow-0"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" /><input className="field pl-10" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" /></div>
        <div className="flex flex-wrap gap-1.5">
          {['all', ...TRIBAL].map((c) => <button key={c} onClick={() => setLang(c)} className={cx('rounded-full px-3.5 py-1.5 text-sm font-semibold', lang === c ? 'bg-sal-800 text-white' : 'bg-white text-sal-800 ring-1 ring-line')}>{c === 'all' ? 'All languages' : LANGS[c].name}</button>)}
        </div>
        <label className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-sal-800"><input type="checkbox" className="h-4 w-4 accent-sal-600" checked={risk} onChange={(e) => setRisk(e.target.checked)} />Only children needing support</label>
      </div>
      <ErrorNote error={error} retry={reload} />
      {loading ? <Skeleton className="h-96" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-sal-50 text-mist"><tr>{['Child', 'Mother tongue', 'Comprehension', 'Reading', 'Streak', 'Last active'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id} onClick={() => setParams({ open: s.id })} className="cursor-pointer hover:bg-sal-50/70" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setParams({ open: s.id })}>
                  <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar emoji={s.avatar} size={34} /><span><b className="block text-sal-800">{s.name}</b><span className="text-xs text-mist">Class {s.grade} · {s.village}</span></span>{flagged.has(s.id) && <span className="h-2 w-2 rounded-full bg-madder-500" title="Needs support" />}</span></td>
                  <td className="px-4 py-3"><Chip tone="gold">{langName(s.language)}</Chip></td>
                  <td className="px-4 py-3"><span className="flex items-center gap-2"><span className={cx('w-9 font-bold', pctColor(s.comprehension))}>{s.comprehension ?? '–'}%</span><Progress value={s.comprehension} className="w-20" /></span></td>
                  <td className={cx('px-4 py-3 font-semibold', pctColor(s.pronunciation))}>{s.pronunciation ?? '–'}{s.pronunciation != null && '%'}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 font-semibold text-sal-800"><Flame size={14} className={s.streak ? 'text-madder-500' : 'text-slate-300'} />{s.streak}</span></td>
                  <td className="px-4 py-3 text-mist">{ago(s.last_active)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">No children match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Detail id={openId} onClose={() => setParams({})} />
    </div>
  )
}

function Detail({ id, onClose }) {
  const toast = useToast()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setD(null); setErr(null); if (id) api.get(`/api/teacher/students/${id}`).then(setD).catch(setErr) }, [id])

  const send = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const r = await api.post('/api/teacher/messages', { student_id: id, text: msg }); setMsg(''); toast(r.delivered_in === 'hi' ? 'Sent to parent (in Hindi)' : `Sent to parent in ${langName(r.delivered_in)}`) }
    catch (er) { toast(er.message, 'err') }
    setBusy(false)
  }

  return (
    <Sheet open={!!id} onClose={onClose} title={d ? d.stats.name : 'Student'} wide>
      <ErrorNote error={err} />
      {!d && !err && <Skeleton className="h-64" />}
      {d && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-3"><Avatar emoji={d.stats.avatar} size={56} /><div><p className="text-sm text-mist">Class {d.stats.grade} · {d.stats.village}</p><Chip tone="gold">{langName(d.stats.language)}</Chip></div>
            <Link to={`/print/report/${id}`} className="btn btn-soft ml-auto"><FileText size={16} />Bilingual report</Link></div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[['Comprehension', d.stats.comprehension != null ? `${d.stats.comprehension}%` : '–', pctColor(d.stats.comprehension)], ['Reading', d.stats.pronunciation != null ? `${d.stats.pronunciation}%` : '–', pctColor(d.stats.pronunciation)], ['Streak', `${d.stats.streak} d`, 'text-sal-800'], ['Stars', d.stats.stars, 'text-mahua-600']].map(([l, v, c]) => <div key={l} className="rounded-xl bg-sal-50 p-3"><p className="text-xs font-semibold text-mist">{l}</p><p className={cx('font-display text-2xl font-extrabold', c)}>{v}</p></div>)}
          </div>
          <div className="h-44"><ResponsiveContainer><LineChart data={d.daily.map((x) => ({ ...x, label: x.date.slice(5) }))} margin={{ left: -20, right: 8 }}><CartesianGrid stroke="#E3ECE6" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={2} /><YAxis domain={[20, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip formatter={(v) => [`${v}%`, 'Quiz score']} /><Line type="monotone" dataKey="score" stroke="#23745A" strokeWidth={3} connectNulls dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
          {d.alerts.length > 0 && <ul className="space-y-2">{d.alerts.map((a, i) => <li key={i} className={cx('rounded-xl p-3 text-sm', a.severity === 'high' ? 'bg-madder-50' : 'bg-mahua-100')}><b className="text-sal-900">{a.title}.</b> {a.detail} <span className="text-mist">{a.suggestion}</span></li>)}</ul>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><h3 className="mb-2 font-bold text-sal-800">Subjects</h3>{Object.entries(d.stats.subjects).map(([k, v]) => <div key={k} className="mb-2"><div className="mb-1 flex justify-between text-sm"><span>{k}</span><b className={pctColor(v)}>{v}%</b></div><Progress value={v} /></div>)}</div>
            <div><h3 className="mb-2 font-bold text-sal-800">Recent activity</h3><ul className="space-y-1.5 text-sm">{d.recent.slice(0, 5).map((r, i) => <li key={i} className="flex justify-between gap-2"><span>{r.emoji} {r.lesson} <span className="text-mist">({r.kind})</span></span><b className={pctColor(r.score)}>{Math.round(r.score)}%</b></li>)}</ul></div>
          </div>
          {d.parent ? (
            <form onSubmit={send} className="rounded-2xl bg-sal-50 p-4">
              <h3 className="font-bold text-sal-800">Message {d.parent.name} <span className="font-normal text-mist">· delivered in {langName(d.parent.language)} when a translation exists</span></h3>
              <div className="mt-2 flex gap-2"><input className="field" required value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write in Hindi, for example: कल स्कूल आइए।" lang="hi" /><Button disabled={busy}><Send size={16} />Send</Button></div>
            </form>
          ) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-mist">No parent account is linked to this child yet.</p>}
        </div>
      )}
    </Sheet>
  )
}
