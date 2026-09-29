import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { useLoad } from '../../lib/hooks'
import { LANGS } from '../../lib/i18n'
import { ErrorNote, Logo, Progress, Skeleton } from '../../components/ui'

const STATUS = { good: 'Doing well', ok: 'Doing okay', help: 'Needs support' }
const STATUS_HI = { good: 'अच्छा प्रदर्शन', ok: 'ठीक प्रदर्शन', help: 'सहयोग की ज़रूरत' }

export default function PrintReport() {
  const { id } = useParams()
  const { data: r, error, loading, reload } = useLoad(`/api/teacher/report/${id}`)
  if (loading) return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-96" /></div>
  if (error) return <div className="mx-auto max-w-3xl p-8"><ErrorNote error={error} retry={reload} /></div>
  const native = r.report_lang !== 'hi' && r.report_lang !== 'en'
  const s = r.student, h = r.hindi
  const subjects = Object.entries(r.subjects).filter(([, v]) => v != null)

  return (
    <div className="min-h-dvh bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <Link to="/teacher/reports" className="inline-flex items-center gap-1 text-sm font-bold text-sal-700"><ChevronLeft size={18} />Back</Link>
        <button onClick={() => window.print()} className="btn btn-primary"><Printer size={16} />Print or save as PDF</button>
      </div>
      <article className="mx-auto max-w-[820px] bg-white p-10 shadow-xl print:max-w-none print:p-6 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-sal-800 pb-4">
          <Logo size={44} />
          <div className="text-right text-sm text-mist"><p className="font-bold text-sal-800">Progress report · प्रगति रिपोर्ट</p><p>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p><p>Teacher: {r.teacher}</p></div>
        </header>
        <section className="mt-5 flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-sal-100 text-4xl">{s.avatar}</span>
          <div><h1 className="text-3xl font-extrabold text-sal-800">{s.name}</h1><p className="text-mist">Class {s.grade} · {s.village} · Mother tongue: {LANGS[s.language]?.name} <span lang={s.language}>({LANGS[s.language]?.native})</span></p></div>
          <p className="ml-auto rounded-xl bg-sal-100 px-4 py-2 text-center font-bold text-sal-800">{STATUS[r.status]}<br /><span lang="hi" className="text-sm font-semibold">{STATUS_HI[r.status]}</span></p>
        </section>
        <section className="mt-5 grid grid-cols-4 gap-3 text-center">
          {[['Comprehension · समझ', r.numbers.comprehension != null ? `${r.numbers.comprehension}%` : '–'], ['Reading · पढ़ना', r.numbers.pronunciation != null ? `${r.numbers.pronunciation}%` : '–'], ['Streak · लगातार दिन', r.numbers.streak], ['Stars · सितारे', r.numbers.stars]].map(([l, v]) => <div key={l} className="rounded-xl border border-line p-3"><p className="font-display text-3xl font-extrabold text-sal-800">{v}</p><p className="text-xs text-mist">{l}</p></div>)}
        </section>
        {subjects.length > 0 && <section className="mt-5 grid gap-2">{subjects.map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-sm"><span className="font-semibold text-sal-800">{k}</span><Progress value={v} /><b>{v}%</b></div>)}</section>}
        <section className={`mt-6 grid gap-6 ${native ? 'grid-cols-2' : ''}`}>
          {native && (
            <div><h2 className="mb-2 text-lg font-bold text-sal-800">{LANGS[r.report_lang].name} <span className="font-normal text-mist" lang={r.report_lang}>({LANGS[r.report_lang].native})</span></h2>
              <ul className="space-y-2">{[...r.lines, ...r.tips].map((l) => <li key={l.key} className="text-[17px] leading-snug" lang={l.lang}>{l.text}{!l.translated && <span className="ml-1 rounded bg-slate-100 px-1 text-xs text-mist">Hindi</span>}</li>)}</ul></div>
          )}
          <div><h2 className="mb-2 text-lg font-bold text-sal-800">हिन्दी <span className="font-normal text-mist">(Hindi)</span></h2>
            <ul className="space-y-2">{[...h.lines, ...h.tips].map((l) => <li key={l.key} className="text-[17px] leading-snug" lang="hi">{l.text}</li>)}</ul></div>
        </section>
        <footer className="mt-12 grid grid-cols-2 gap-10 text-sm text-mist"><div className="border-t border-slate-300 pt-1">Class teacher · कक्षा शिक्षक</div><div className="border-t border-slate-300 pt-1">Parent · अभिभावक</div></footer>
        <p className="mt-6 text-[11px] text-mist">Translations marked as drafts are machine-generated and pending checking by a native-speaker teacher.</p>
      </article>
    </div>
  )
}
