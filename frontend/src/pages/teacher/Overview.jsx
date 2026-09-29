import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Download, Languages, Radio, TrendingUp, UserRoundCheck, Users, HandHelping, MessageCircleWarning } from 'lucide-react'
import * as api from '../../lib/api'
import { useAuth } from '../../lib/session'
import { useLoad } from '../../lib/hooks'
import { Avatar, Button, Chip, ErrorNote, Progress, Skeleton, cx, useToast } from '../../components/ui'
import { PageHead, Panel, SEV, ago, langName, pctColor } from './common'

function Kpi({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', tone)}><Icon size={24} /></span>
      <div><p className="text-sm font-semibold text-mist">{label}</p><p className="font-display text-4xl font-extrabold leading-tight text-sal-800">{value}</p><p className="text-xs text-mist">{sub}</p></div>
    </div>
  )
}

const day = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function Overview() {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const { data: o, error, loading, reload } = useLoad('/api/teacher/overview')

  if (loading) return <div className="grid gap-4"><Skeleton className="h-24" /><div className="grid gap-4 lg:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-80" /></div>
  if (error) return <ErrorNote error={error} retry={reload} />
  const k = o.kpis
  const alerts = o.alerts.slice(0, 6)
  const trend = o.trend.map((t) => ({ ...t, label: day(t.date) }))

  return (
    <div>
      <PageHead title={`Good day, ${user.name.split(' ')[0]}`} sub={`Govt. Primary School, ${user.village} · ${k.students} children · ${k.languages} mother tongues`}>
        <Button variant="outline" onClick={() => api.download('/api/teacher/export.csv', 'class-report.csv').catch((e) => toast(e.message, 'err'))}><Download size={16} />Export CSV</Button>
        <Button onClick={() => nav('/teacher/live')}><Radio size={16} />Start live class</Button>
      </PageHead>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Learning today" value={`${k.active_today}/${k.students}`} sub={`${k.active_week} active this week`} tone="bg-sal-100 text-sal-700" />
        <Kpi icon={Languages} label="Mother tongues" value={k.languages} sub={o.languages.map((l) => l.name).join(', ')} tone="bg-mahua-100 text-mahua-700" />
        <Kpi icon={TrendingUp} label="Average comprehension" value={`${k.avg_comprehension}%`} sub="Latest 10 quizzes per child" tone="bg-river-100 text-river-700" />
        <Kpi icon={UserRoundCheck} label="Need support" value={k.needs_support} sub="Flagged by early warnings" tone="bg-madder-100 text-madder-700" />
      </div>

      {o.pending_reviews > 0 && (
        <Link to="/teacher/content" className="mt-4 flex items-center gap-4 rounded-2xl border border-mahua-300 bg-mahua-100 p-4 hover:bg-mahua-200/70">
          <span className="text-2xl">📝</span>
          <p className="grow text-sm text-sal-900"><b>{o.pending_reviews} translations are drafts.</b> Children see a “draft” tag until a teacher who speaks the language checks them.</p>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-mahua-700">Review <ArrowRight size={16} /></span>
        </Link>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4">
          <Panel title="Comprehension, last 14 days" action={<Chip tone="sal">quiz average across the class</Chip>}>
            <div className="h-64" role="img" aria-label="Area chart of daily average quiz score">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#23745A" stopOpacity={0.35} /><stop offset="100%" stopColor="#23745A" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#E3ECE6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5C706A' }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis domain={[50, 100]} ticks={[50, 60, 70, 80, 90, 100]} tick={{ fontSize: 12, fill: '#5C706A' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v, n) => [`${v}${n === 'comprehension' ? '%' : ''}`, n === 'comprehension' ? 'Average score' : 'Children active']} contentStyle={{ borderRadius: 12, border: '1px solid #D5E1DA' }} />
                  <Area type="monotone" dataKey="comprehension" stroke="#23745A" strokeWidth={3} fill="url(#g)" connectNulls dot={{ r: 3, fill: '#23745A' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="By mother tongue">
              <ul className="space-y-3.5">
                {o.languages.map((l) => (
                  <li key={l.code}>
                    <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-semibold text-sal-800">{l.name} <span className="font-normal text-mist" lang={l.code}>{l.native}</span></span><span className={cx('font-bold', pctColor(l.comprehension))}>{l.comprehension ?? '–'}%</span></div>
                    <Progress value={l.comprehension} /><p className="mt-0.5 text-xs text-mist">{l.students} children</p>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Where children got stuck" action={<Chip tone="red">{o.confusions_7d} taps this week</Chip>}>
              {o.confusion_by_lesson.length === 0 ? <p className="text-sm text-mist">No “I did not get this” taps this week.</p> : (
                <div className="h-44">
                  <ResponsiveContainer>
                    <BarChart data={o.confusion_by_lesson} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="lesson" width={112} tick={{ fontSize: 12, fill: '#10241E' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#EEF5F0' }} formatter={(v) => [v, 'Taps']} contentStyle={{ borderRadius: 12 }} />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={16}>{o.confusion_by_lesson.map((_, i) => <Cell key={i} fill={i === 0 ? '#C2412D' : '#E58F7E'} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 text-xs text-mist">Re-teach the top lesson first, with picture cards.</p>
            </Panel>
          </div>
        </div>

        <Panel title="Students needing support" action={<Link to="/teacher/students" className="text-sm font-bold text-sal-600">All students</Link>} className="self-start">
          <ul className="divide-y divide-line">
            {alerts.map((a, i) => {
              const s = SEV[a.severity]
              return (
                <li key={i} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Avatar emoji={a.avatar} size={40} />
                    <div className="min-w-0 grow">
                      <p className="flex flex-wrap items-center gap-x-2 font-bold text-sal-800">{a.student}<Chip tone="gold">{langName(a.language)}</Chip><Chip tone={s.chip}>{s.label}</Chip></p>
                      <p className="mt-0.5 text-sm text-ink">{a.detail}</p>
                      <p className="mt-1 text-sm text-mist">{a.suggestion}</p>
                      <div className="mt-2 flex gap-2"><Button variant="soft" className="!min-h-8 !px-3 !py-1 text-xs" onClick={() => nav(`/teacher/students?open=${a.student_id}`)}>Open profile</Button></div>
                    </div>
                  </div>
                </li>
              )
            })}
            {alerts.length === 0 && <li className="py-6 text-center text-sm text-mist">Everyone is on track. 🎉</li>}
          </ul>
        </Panel>
      </div>

      {o.recent_confusions.length > 0 && (
        <Panel title="Latest “I did not get this” taps" className="mt-4" action={<HandHelping className="text-madder-500" size={20} />}>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {o.recent_confusions.map((c, i) => <li key={i} className="flex items-center gap-3 rounded-xl bg-madder-50 px-3 py-2 text-sm"><MessageCircleWarning size={18} className="text-madder-500" /><span><b>{c.student}</b> · {c.lesson || 'live class'} <span className="text-mist">· {ago(c.at)}</span></span></li>)}
          </ul>
        </Panel>
      )}
    </div>
  )
}
