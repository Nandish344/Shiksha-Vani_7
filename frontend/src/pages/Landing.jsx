import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, AudioLines, BookOpenCheck, Cloud, Languages, Mic, Smartphone, WifiOff, Loader2, KeyRound } from 'lucide-react'
import * as api from '../lib/api'
import { useAuth } from '../lib/session'
import { LANGS, TRIBAL } from '../lib/i18n'
import { Avatar, Chip, Logo, cx, useToast } from '../components/ui'

const HOME = { student: '/student', teacher: '/teacher', parent: '/parent' }

/** The one memorable moment: a word said once, arriving in four mother tongues. */
function Relay() {
  const [words, setWords] = useState([])
  const [i, setI] = useState(0)
  useEffect(() => { api.get('/api/showcase', { cacheIt: true }).then(setWords).catch(() => {}) }, [])
  useEffect(() => {
    if (words.length < 2) return
    const id = setInterval(() => setI((n) => (n + 1) % words.length), 3800)
    return () => clearInterval(id)
  }, [words.length])
  const w = words[i]
  return (
    <div className="rounded-hero border border-sal-600/60 bg-sal-900/55 p-5 backdrop-blur sm:p-6" aria-live="off">
      <div className="flex items-end justify-between gap-4">
        <div key={w?.en} className="rise">
          <p className="font-display text-5xl font-extrabold leading-none text-mahua-300 sm:text-6xl">{w?.hi || '…'}</p>
          <p className="mt-1.5 text-sm text-sal-200">{w ? `${w.en} · said once in Hindi` : 'Loading words…'}</p>
        </div>
        <Mic className="mb-1 shrink-0 text-mahua-300" size={28} aria-hidden />
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-2.5">
        {TRIBAL.map((code, n) => (
          <li key={code} className="rounded-2xl bg-sal-800/90 px-3.5 py-2.5 ring-1 ring-sal-600/50">
            <p className="text-xs font-semibold text-sal-300">{LANGS[code].name}</p>
            <p key={`${w?.en}-${code}`} className="rise font-display text-2xl font-bold text-white" style={{ animationDelay: `${n * 140}ms` }}>
              {w?.terms?.[code] || <span className="text-base font-medium text-sal-400">not added yet</span>}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-sal-300">Words are drafts until a teacher who speaks the language checks them.</p>
    </div>
  )
}

function TryIt() {
  const [text, setText] = useState('')
  const [src, setSrc] = useState('en')
  const [out, setOut] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      const rows = await Promise.all(TRIBAL.map((tgt) => api.post('/api/translate', { text: text.trim(), src, tgt }).then((r) => ({ tgt, ...r }))))
      setOut(rows)
    } catch { setOut([]) }
    setBusy(false)
  }
  return (
    <form onSubmit={run} className="mt-4 rounded-2xl bg-sal-900/40 p-3 ring-1 ring-sal-600/40">
      <div className="flex gap-2">
        <select value={src} onChange={(e) => setSrc(e.target.value)} className="rounded-xl border-0 bg-sal-800 px-2 text-sm font-semibold text-white" aria-label="Language you type in">
          <option value="en">English</option><option value="hi">हिन्दी</option>
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Try: tree, water, Open your books." maxLength={120}
          className="min-w-0 flex-1 rounded-xl border-0 bg-white/95 px-3 py-2 text-sm text-ink placeholder:text-mist" aria-label="Text to translate" />
        <button className="btn bg-mahua-400 text-sal-900 hover:bg-mahua-300" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Translate'}</button>
      </div>
      {out && (
        <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {out.map((r) => (
            <li key={r.tgt} className="flex items-baseline justify-between gap-2 rounded-lg bg-sal-800/70 px-3 py-1.5">
              <span className="text-sal-300">{LANGS[r.tgt].name}</span>
              {r.status === 'missing' ? <span className="text-sal-400">not in memory yet</span> : <span className="font-semibold text-white">{r.text}{r.status === 'approx' ? <span className="ml-1 text-xs font-normal text-mahua-300">≈ closest saved phrase</span> : r.status !== 'verified' && <span className="ml-1 text-mahua-300">*</span>}</span>}
            </li>
          ))}
          <li className="text-xs text-sal-300 sm:col-span-2">* draft. Sentences use Bhashini when the server has keys; otherwise only saved words and phrases are found.</li>
        </ul>
      )}
    </form>
  )
}

const ROLE_CARDS = [
  { role: 'student', user: 'sona', title: 'Student', who: 'Sona, Grade 3 · Santali', icon: BookOpenCheck, tone: 'bg-mahua-400 text-sal-900' },
  { role: 'teacher', user: 'teacher', title: 'Teacher', who: 'Meena Kumari · 32 students', icon: Languages, tone: 'bg-sal-500 text-white' },
  { role: 'parent', user: 'parent', title: 'Parent', who: 'Sukhram Murmu · Santali', icon: Smartphone, tone: 'bg-river-500 text-white' },
]

function Login() {
  const { user, demo, login } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [others, setOthers] = useState([])
  const [manual, setManual] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })

  useEffect(() => { api.get('/api/auth/demo-users').then((u) => setOthers(u.filter((x) => ['anita', 'birsa', 'sunita'].includes(x.username)))).catch(() => {}) }, [])

  const go = async (fn, key) => {
    setBusy(key)
    try { const u = await fn(); nav(HOME[u.role]) }
    catch (e) { toast(e.message || 'Could not log in', 'err') }
    setBusy('')
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h2 className="text-3xl font-extrabold text-sal-800">Try the live demo</h2>
      <p className="mt-1 text-mist">One tap opens a ready-made classroom with 32 students and a month of progress.</p>

      {user && (
        <button onClick={() => nav(HOME[user.role])} className="mt-5 flex w-full items-center gap-3 rounded-2xl border-2 border-sal-500 bg-white p-3 text-left">
          <Avatar emoji={user.avatar} size={44} /><span className="grow"><b className="block text-sal-800">Continue as {user.name}</b><span className="text-sm capitalize text-mist">{user.role}</span></span><ArrowRight />
        </button>
      )}

      <ul className="mt-5 grid gap-3">
        {ROLE_CARDS.map(({ role, user: u, title, who, icon: Icon, tone }) => (
          <li key={role}>
            <button onClick={() => go(() => demo(u), role)} disabled={!!busy}
              className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-3.5 text-left shadow-card transition hover:border-sal-400 hover:shadow-lg">
              <span className={cx('grid h-12 w-12 place-items-center rounded-2xl', tone)}>{busy === role ? <Loader2 className="animate-spin" /> : <Icon />}</span>
              <span className="grow"><b className="block font-display text-lg text-sal-800">{title}</b><span className="text-sm text-mist">{who}</span></span>
              <ArrowRight className="text-sal-400 transition-transform group-hover:translate-x-1" />
            </button>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-sal-800">See it in another mother tongue</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((o) => (
              <button key={o.id} onClick={() => go(() => demo(o.username), o.username)} className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3.5 text-sm font-semibold text-sal-800 hover:bg-sal-50">
                <Avatar emoji={o.avatar} size={28} />{o.name.split(' ')[0]} <Chip tone="gold">{LANGS[o.language].name}</Chip>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <button onClick={() => setManual((m) => !m)} className="inline-flex items-center gap-2 text-sm font-semibold text-sal-700"><KeyRound size={16} /> Sign in with a username</button>
        {manual && (
          <form className="mt-3 grid gap-2.5" onSubmit={(e) => { e.preventDefault(); go(() => login(form.username, form.password), 'manual') }}>
            <input className="field" placeholder="Username" autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input className="field" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button className="btn btn-primary" disabled={!!busy}>{busy === 'manual' ? <Loader2 size={16} className="animate-spin" /> : 'Log in'}</button>
            <p className="text-xs text-mist">Demo accounts use the password <code className="rounded bg-sal-100 px-1">demo123</code>.</p>
          </form>
        )}
      </div>
    </div>
  )
}

const PIPE = [
  { icon: Mic, t: 'Teacher speaks', d: 'Hindi or English, in the browser. No special hardware.' },
  { icon: AudioLines, t: 'Speech becomes text', d: 'Browser speech recognition, with Bhashini or Whisper on the server.' },
  { icon: Languages, t: 'Translated', d: 'Saved translations first, then Bhashini, then the closest match.' },
  { icon: Smartphone, t: 'Every child, own language', d: 'Captions and lessons on their tablet or phone, read aloud where voices exist.' },
  { icon: Cloud, t: 'Feedback returns', d: 'Quiz scores and “I did not get this” taps reach the teacher, even after being offline.' },
]

export default function Landing() {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[1.15fr_1fr]">
        <section className="relative flex flex-col bg-sal-800 px-6 pb-10 pt-6 text-white sm:px-10 lg:px-14">
          <Logo dark size={40} />
          <div className="my-auto max-w-2xl py-10 lg:py-14">
            <h1 className="text-4xl font-extrabold leading-[1.08] sm:text-5xl xl:text-6xl">Lessons in the language a child speaks at home.</h1>
            <p className="mt-5 max-w-xl text-lg text-sal-100/90">
              Shiksha Vani teaches, translates and checks understanding in Santali, Mundari, Ho and Kurukh. Live in class, and offline in the village.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Chip tone="gold"><WifiOff size={13} /> Works offline</Chip>
              <Chip tone="gold">NEP 2020: mother tongue to Grade 5</Chip>
              <Chip tone="gold">Teacher checks every AI translation</Chip>
            </div>
            <div className="mt-8 max-w-xl"><Relay /><TryIt /></div>
          </div>
          <p className="text-xs text-sal-300">Team Brute Force · Smart India Hackathon 2026 · Problem statement 26042</p>
          <div className="band absolute inset-x-0 bottom-0 max-lg:hidden" aria-hidden />
        </section>
        <section className="flex items-center px-6 py-12 sm:px-10"><Login /></section>
      </div>

      <section className="border-t border-line bg-white px-6 py-14 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-extrabold text-sal-800">How one sentence reaches every child</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PIPE.map(({ icon: Icon, t, d }, n) => (
              <li key={t} className="relative rounded-2xl border border-line bg-paper p-4">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-sal-800 text-mahua-300"><Icon size={22} /></span>
                <h3 className="text-lg font-bold text-sal-800">{t}</h3>
                <p className="mt-1 text-sm text-mist">{d}</p>
                {n < PIPE.length - 1 && <ArrowRight className="absolute -right-3.5 top-9 z-10 hidden text-mahua-500 lg:block" size={22} />}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}
