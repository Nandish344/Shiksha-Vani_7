import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, SendHorizonal, Volume2, Square, Sparkles } from 'lucide-react'
import * as api from '../../lib/api'
import { useI18n, LANGS } from '../../lib/i18n'
import { canListen, canSpeak, listen, speak } from '../../lib/speech'
import { Chip, cx, useToast } from '../../components/ui'

export default function Tutor() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [rec, setRec] = useState(null)
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  const ideas = LANGS[lang].tribal
    ? [lang === 'sat' ? 'What do roots do?' : 'पेड़ हमें क्या देते हैं?', `water in ${LANGS[lang].name}`, `tree in ${LANGS[lang].name}`]
    : lang === 'hi' ? ['जड़ें क्या करती हैं?', 'पानी कहाँ से मिलता है?', 'पेड़ हमें क्या देते हैं?'] : ['What do roots do?', 'Where does water come from?', 'Why did the crow drop stones?']

  const send = async (q) => {
    const message = (q ?? text).trim()
    if (!message || busy) return
    setText('')
    setMsgs((m) => [...m, { role: 'user', text: message }])
    setBusy(true)
    try {
      const history = msgs.slice(-6).map((m) => ({ role: m.role, text: m.text }))
      const r = await api.post('/api/tutor', { message, history })
      setMsgs((m) => [...m, { role: 'assistant', text: r.reply, kind: r.kind, lang: r.reply_lang, sources: r.sources, engine: r.engine }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: e.message, kind: 'error' }])
    }
    setBusy(false)
  }

  const mic = () => {
    if (rec) { rec.stop(); setRec(null); return }
    if (!canListen()) return toast(t('stt_missing'), 'err')
    const sttLang = LANGS[lang].stt ? lang : 'hi'
    const r = listen({ lang: sttLang, onInterim: setText, onFinal: (v) => { setRec(null); setText(''); send(v) }, onEnd: () => setRec(null), onError: (e) => { setRec(null); toast(e === 'not-allowed' ? t('mic_denied') : t('stt_missing'), 'err') } })
    setRec(r)
  }

  const shown = (m) => m.kind === 'none' || (m.kind === 'lesson' && !m.text) || (!m.text && m.role === 'assistant') ? t('tutor_none') : m.text

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <h1 className="text-3xl font-extrabold text-sal-800">{t('ask_tutor')}</h1>
      <div className="mt-3 grow space-y-3 pb-3">
        {msgs.length === 0 && (
          <div className="rounded-hero bg-sal-800 p-5 text-white">
            <Sparkles className="text-mahua-300" />
            <p className="mt-2 font-display text-xl font-bold" lang={lang}>{t('tutor_hello')}</p>
            <p className="mt-4 text-sm font-semibold text-sal-200">{t('try_asking')}</p>
            <div className="mt-2 flex flex-wrap gap-2">{ideas.map((i) => <button key={i} onClick={() => send(i)} className="rounded-full bg-white/12 px-3.5 py-2 text-left text-sm font-semibold ring-1 ring-white/25 hover:bg-white/20" lang={lang}>{i}</button>)}</div>
          </div>
        )}
        {msgs.map((m, n) => m.role === 'user' ? (
          <div key={n} className="flex justify-end"><p className="max-w-[85%] rounded-3xl rounded-br-lg bg-mahua-300 px-4 py-2.5 text-lg font-semibold text-sal-900">{m.text}</p></div>
        ) : (
          <div key={n} className="rise flex">
            <div className={cx('max-w-[90%] rounded-3xl rounded-bl-lg px-4 py-3 ring-1', m.kind === 'error' ? 'bg-madder-50 text-madder-700 ring-madder-100' : 'bg-white ring-line')}>
              {m.kind === 'lesson' && m.text && <p className="mb-1 text-sm font-bold text-sal-600">{t('tutor_says_lesson')}</p>}
              <p className="text-xl leading-snug text-ink" lang={m.lang}>{shown(m)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {m.sources?.[0] && m.kind !== 'word' && m.kind !== 'greeting' && <Chip tone="sal">{t('tutor_from')}: {m.sources[0].lesson}</Chip>}
                {m.engine === 'claude' && <Chip tone="blue">AI</Chip>}
                {m.text && m.kind !== 'error' && canSpeak(m.lang) && <button onClick={() => speak(m.text, m.lang)} className="inline-flex items-center gap-1 rounded-full bg-sal-800 px-3 py-1 text-sm font-bold text-white"><Volume2 size={14} />{t('listen')}</button>}
              </div>
            </div>
          </div>
        ))}
        {busy && <div className="flex"><p className="rounded-3xl rounded-bl-lg bg-white px-4 py-3 text-mist ring-1 ring-line">{t('tutor_thinking')}</p></div>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send() }} className="sticky bottom-24 flex items-center gap-2 rounded-full bg-white p-1.5 pl-4 shadow-lg ring-1 ring-line">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('type_question')} className="min-w-0 grow bg-transparent text-lg outline-none placeholder:text-mist/70" aria-label={t('type_question')} />
        <button type="button" onClick={mic} aria-label="Speak" className={cx('grid h-12 w-12 place-items-center rounded-full', rec ? 'bg-madder-500 text-white pulse-ring' : 'bg-sal-100 text-sal-700')}>{rec ? <Square size={18} fill="currentColor" /> : <Mic size={22} />}</button>
        <button aria-label={t('send')} disabled={!text.trim() || busy} className="grid h-12 w-12 place-items-center rounded-full bg-sal-800 text-white disabled:opacity-40"><SendHorizonal size={20} /></button>
      </form>
    </div>
  )
}
