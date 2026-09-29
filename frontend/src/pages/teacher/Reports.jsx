import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Search, Send } from 'lucide-react'
import * as api from '../../lib/api'
import { useLoad } from '../../lib/hooks'
import { Avatar, Button, Chip, Empty, ErrorNote, Skeleton, useToast } from '../../components/ui'
import { PageHead, Panel, ago, langName } from './common'

export default function Reports() {
  const toast = useToast()
  const { data: o, error } = useLoad('/api/teacher/overview')
  const { data: msgs, reload: reloadMsgs } = useLoad('/api/teacher/messages')
  const [q, setQ] = useState('')
  const [reply, setReply] = useState({})
  const list = useMemo(() => (o?.students || []).filter((s) => s.name.toLowerCase().includes(q.toLowerCase())), [o, q])
  const send = async (m) => {
    try { await api.post('/api/teacher/messages', { student_id: m.student_id, text: reply[m.id] }); setReply({ ...reply, [m.id]: '' }); toast('Reply sent'); reloadMsgs() }
    catch (e) { toast(e.message, 'err') }
  }
  return (
    <div>
      <PageHead title="Reports & parents" sub="Bilingual progress reports and messages, translated between Hindi and each family's language.">
        <Button variant="outline" onClick={() => api.download('/api/teacher/export.csv', 'class-report.csv').catch((e) => toast(e.message, 'err'))}><Download size={16} />Export class CSV</Button>
      </PageHead>
      <ErrorNote error={error} />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Progress report for a child" action={<div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" /><input className="field !py-1.5 pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" /></div>}>
          {!o ? <Skeleton className="h-64" /> : (
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <Avatar emoji={s.avatar} size={36} />
                  <span className="min-w-0 grow"><b className="block truncate text-sal-800">{s.name}</b><span className="text-xs text-mist">Class {s.grade} · {s.comprehension ?? '–'}% comprehension</span></span>
                  <Chip tone="gold">{langName(s.language)}</Chip>
                  <Link to={`/print/report/${s.id}`} className="btn btn-soft !min-h-9"><FileText size={15} />Open</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Messages from parents">
          {msgs?.length === 0 && <Empty icon="💬" title="No messages yet">When a parent writes from their app, the message arrives here in Hindi.</Empty>}
          <ul className="space-y-3">
            {(msgs || []).filter((m) => !m.mine).map((m) => (
              <li key={m.id} className="rounded-xl bg-sal-50 p-3">
                <p className="text-xs font-semibold text-mist">{m.from} · about {m.student} · {ago(m.at)}</p>
                <p className="mt-1 text-lg" lang="hi">{m.text}</p>
                {m.text !== m.original && <p className="text-xs text-mist">Original ({langName(m.lang)}): {m.original}</p>}
                <div className="mt-2 flex gap-2"><input className="field !py-1.5" lang="hi" placeholder="Reply in Hindi" value={reply[m.id] || ''} onChange={(e) => setReply({ ...reply, [m.id]: e.target.value })} /><Button disabled={!reply[m.id]?.trim()} onClick={() => send(m)}><Send size={15} /></Button></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
