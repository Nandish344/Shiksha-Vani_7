import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { BookOpen, Home, LayoutDashboard, LogOut, MessageCircle, Mic, Radio, User, Users, Languages, FileText, WifiOff, RefreshCw, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth, useNet } from '../lib/session'
import { useI18n, LANGS } from '../lib/i18n'
import * as api from '../lib/api'
import { Avatar, Chip, Logo, cx } from './ui'

export function OfflinePill({ className }) {
  const { online, pending, syncing, flush } = useNet()
  const { t } = useI18n()
  if (online && !pending) {
    return <span className={cx('inline-flex items-center gap-1 rounded-full bg-sal-100 px-2.5 py-1 text-xs font-semibold text-sal-700', className)}><Check size={13} />{t('online')}</span>
  }
  return (
    <button onClick={flush} className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', online ? 'bg-mahua-100 text-mahua-700' : 'bg-madder-100 text-madder-700', className)}>
      {online ? <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> : <WifiOff size={13} />}
      {online ? `${pending} ${t('waiting_sync')}` : `${t('offline')}${pending ? ` · ${pending}` : ''}`}
    </button>
  )
}

/* ------------------------------------------------------------------ student / parent phone-style shell */
export function StudentShell() {
  const { t, lang } = useI18n()
  const { pathname } = useLocation()
  const hideNav = pathname.includes('/live/') || pathname.includes('/quiz/')
  const tabs = [
    { to: '/student', end: true, icon: Home, label: t('home') },
    { to: '/student/lessons', icon: BookOpen, label: t('lessons') },
    { to: '/student/ask', icon: MessageCircle, label: t('ask') },
    { to: '/student/speak', icon: Mic, label: t('speak') },
    { to: '/student/me', icon: User, label: t('me') },
  ]
  return (
    <div className="md:bg-sal-900 md:py-6">
      <div className="relative mx-auto flex min-h-dvh max-w-[460px] flex-col overflow-clip bg-paper md:min-h-[calc(100dvh-3rem)] md:rounded-[32px] md:shadow-2xl md:ring-1 md:ring-sal-700">
        <div className="band" aria-hidden />
        <header className="flex items-center justify-between px-4 pb-1 pt-3">
          <Link to="/student"><Logo size={30} /></Link>
          <div className="flex items-center gap-2">
            <OfflinePill />
            <Chip tone="gold" lang={lang}>{LANGS[lang]?.native}</Chip>
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-3"><Outlet /></main>
        {!hideNav && (
          <nav className="safe-b sticky bottom-0 z-40 border-t border-line bg-white/95 px-2 pt-2 backdrop-blur" aria-label="Main">
            <ul className="grid grid-cols-5">
              {tabs.map(({ to, end, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold', isActive ? 'text-sal-800' : 'text-mist')}>
                    {({ isActive }) => (<>
                      <span className={cx('grid h-9 w-14 place-items-center rounded-full transition-colors', isActive ? 'bg-mahua-300' : '')}><Icon size={22} strokeWidth={isActive ? 2.6 : 2} /></span>
                      {label}
                    </>)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}

export function ParentShell() {
  const { user, logout } = useAuth()
  const { lang } = useI18n()
  const nav = useNavigate()
  return (
    <div className="md:bg-sal-900 md:py-6">
      <div className="relative mx-auto flex min-h-dvh max-w-[460px] flex-col overflow-clip bg-paper md:min-h-[calc(100dvh-3rem)] md:rounded-[32px] md:shadow-2xl">
        <div className="band" aria-hidden />
        <header className="flex items-center justify-between px-4 pb-1 pt-3">
          <Logo size={30} />
          <div className="flex items-center gap-2">
            <OfflinePill />
            <Chip tone="gold" lang={lang}>{LANGS[lang]?.native}</Chip>
            <button aria-label="Log out" className="grid h-9 w-9 place-items-center rounded-full text-sal-800 hover:bg-sal-100" onClick={() => { logout(); nav('/') }}><LogOut size={18} /></button>
          </div>
        </header>
        <main className="flex-1 px-4 pb-10 pt-3"><Outlet /></main>
        <div className="px-4 pb-4 text-center text-xs text-mist">{user?.name}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ teacher desktop shell */
const TNAV = [
  { to: '/teacher', end: true, icon: LayoutDashboard, label: 'Overview' },
  { to: '/teacher/live', icon: Radio, label: 'Live class' },
  { to: '/teacher/students', icon: Users, label: 'Students' },
  { to: '/teacher/content', icon: Languages, label: 'Content review' },
  { to: '/teacher/reports', icon: FileText, label: 'Reports' },
]

export function TeacherShell() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [live, setLive] = useState(null)
  useEffect(() => {
    const load = () => api.get('/api/sessions/live', { cacheIt: false }).then((r) => setLive(r[0] || null)).catch(() => {})
    load(); const i = setInterval(load, 15000)
    return () => clearInterval(i)
  }, [])
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col bg-sal-800 text-sal-100 max-lg:sticky max-lg:top-0 max-lg:z-30 lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center justify-between px-5 pb-3 pt-5 lg:block"><Logo dark size={34} /></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-1 lg:pb-0 lg:pt-4" aria-label="Teacher">
          {TNAV.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors', isActive ? 'bg-mahua-400 text-sal-900' : 'text-sal-100/85 hover:bg-sal-700')}>
              <Icon size={18} /> {label}
              {label === 'Live class' && live && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-madder-500 pulse-ring" aria-label="Live" />}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-sal-700 p-4 lg:block">
          <div className="flex items-center gap-3">
            <Avatar emoji={user?.avatar} size={38} />
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user?.name}</p><p className="truncate text-xs text-sal-200">{user?.village}</p></div>
            <button onClick={() => { logout(); nav('/') }} className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-sal-700" aria-label="Log out"><LogOut size={18} /></button>
          </div>
        </div>
        <div className="band hidden lg:block" aria-hidden />
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8"><Outlet /></main>
    </div>
  )
}
