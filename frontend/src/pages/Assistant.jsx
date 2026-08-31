import { useState, useRef, useEffect } from 'react'
import { Send, Mic, Bot } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../api/client'
import ChatBubble from '../components/ChatBubble'
import LoadingSpinner from '../components/LoadingSpinner'

const QUICK_QUESTIONS_EN = [
  'How much profit today?',
  "What's running low?",
  'Show unpaid customers',
  'Find noodles',
]

const QUICK_QUESTIONS_NE = [
  'आज कति नाफा भयो?',
  'के घट्दैछ?',
  'नतिरेका ग्राहक देखाउनुहोस्',
  'चाउचाउ खोज्नुहोस्',
]

export default function Assistant() {
  const { t, lang } = useLanguage()
  const [messages, setMessages] = useState([
    {
      id: 1,
      message: lang === 'ne'
        ? "नमस्ते! म तपाईंको किराना सहायक हुँ। तपाईंको पसलको बारेमा केही सोध्नुहोस् - बिक्री, सामान, ग्राहक, वा नाफा!"
        : "Hello! I'm your Kirana Smart Assistant. Ask me anything about your shop - sales, products, customers, or profits!",
      isUser: false,
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const handsFreeRef = useRef(false)
  const speakingRef = useRef(false)
  const awaitingReplyRef = useRef(false)
  const suppressRestartRef = useRef(false)
  const mountedRef = useRef(true)

  const QUICK_QUESTIONS = lang === 'ne' ? QUICK_QUESTIONS_NE : QUICK_QUESTIONS_EN

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      handsFreeRef.current = false
      try { recognitionRef.current?.stop() } catch { /* noop */ }
      window.speechSynthesis?.cancel()
    }
  }, [])

  async function sendMessage(text) {
    const msg = text || input.trim()
    if (!msg || loading) return

    const userMsg = {
      id: Date.now(),
      message: msg,
      isUser: true,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.assistant.chat(msg)
      const botMsg = {
        id: Date.now() + 1,
        message: typeof res.data === 'string' ? res.data : (res.data?.answer || res.data?.response || res.data?.message || t('error')),
        isUser: false,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, botMsg])
      if (handsFreeRef.current) speak(botMsg.message)
    } catch {
      const errorText = lang === 'ne'
        ? 'माफ गर्नुहोस्, सर्भरसँग जडान गर्न सकिएन। कृपया आफ्नो जडान जाँच गर्नुहोस् र फेरि प्रयास गर्नुहोस्।'
        : "Sorry, I couldn't connect to the server. Please check your connection and try again."
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          message: errorText,
          isUser: false,
          timestamp: new Date().toISOString(),
        },
      ])
      if (handsFreeRef.current) speak(errorText)
    } finally {
      setLoading(false)
    }
  }

  function startListening() {
    if (recognitionRef.current) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceNotice(t('voiceUnsupported'))
      inputRef.current?.focus()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = lang === 'ne' ? 'ne-NP' : 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    setVoiceNotice('')
    setListening(true)

    recognition.onresult = event => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript
      setInput(transcript)
      const last = event.results[event.results.length - 1]
      // Hands-free: send the moment the user finishes speaking
      if (handsFreeRef.current && last.isFinal && transcript.trim()) {
        awaitingReplyRef.current = true
        stopListening()
        sendMessage(transcript.trim())
      }
    }
    recognition.onerror = event => {
      recognitionRef.current = null
      setListening(false)
      const code = event?.error
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setVoiceNotice(t('voicePermission'))
      } else if (code === 'no-speech') {
        setVoiceNotice(t('voiceNoSpeech'))
      } else if (code === 'network') {
        setVoiceNotice(t('voiceNetwork'))
      } else {
        setVoiceNotice(t('voiceError'))
      }
      // Never loop on hard failures (blocked mic, no network) — turn the mode off
      if (handsFreeRef.current && code !== 'no-speech') setHandsFreeMode(false)
      // Silence is not a failure in hands-free mode — keep listening
      if (handsFreeRef.current && code === 'no-speech' && mountedRef.current) startListening()
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      // If the loop is on and we're not waiting on a reply or speaking, keep listening
      if (handsFreeRef.current && !awaitingReplyRef.current && !speakingRef.current && mountedRef.current) {
        startListening()
      }
    }
    recognition.start()
  }

  function stopListening() {
    try { recognitionRef.current?.stop() } catch { /* noop */ }
    recognitionRef.current = null
    setListening(false)
  }

  function speak(text) {
    awaitingReplyRef.current = false
    if (!handsFreeRef.current || !mountedRef.current) return
    if (!('speechSynthesis' in window)) {
      if (mountedRef.current) startListening()
      return
    }
    const clean = String(text)
      .replace(/[#*_`>~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!clean) {
      if (mountedRef.current) startListening()
      return
    }

    // Cancel any previous utterance without letting its onend restart the loop
    suppressRestartRef.current = true
    window.speechSynthesis.cancel()
    setTimeout(() => { suppressRestartRef.current = false }, 150)

    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang = lang === 'ne' ? 'ne-NP' : 'en-US'
    utter.rate = 1
    setSpeaking(true)
    speakingRef.current = true

    // iOS workaround: long utterances can stall — nudge them along
    const resumeTimer = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(resumeTimer)
      } else if (!window.speechSynthesis.paused) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)

    const finish = () => {
      clearInterval(resumeTimer)
      setSpeaking(false)
      speakingRef.current = false
      if (suppressRestartRef.current) return
      if (handsFreeRef.current && mountedRef.current) startListening()
    }
    utter.onend = finish
    utter.onerror = finish
    setTimeout(() => window.speechSynthesis.speak(utter), 120)
  }

  function stopEverything() {
    awaitingReplyRef.current = false
    stopListening()
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    speakingRef.current = false
  }

  function setHandsFreeMode(on) {
    handsFreeRef.current = on
    setHandsFree(on)
    if (!on) stopEverything()
  }

  function toggleHandsFree() {
    const next = !handsFreeRef.current
    if (next) {
      awaitingReplyRef.current = false
      setVoiceNotice('')
    }
    setHandsFreeMode(next)
    if (next) startListening()
  }

  function handleMicClick() {
    if (listening) {
      stopListening()
      return
    }
    if (speaking) {
      stopEverything()
      return
    }
    startListening()
  }

  return (
    <div className="flex flex-col h-screen dark:bg-gray-900">
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 bg-gradient-to-br from-primary via-emerald-600 to-teal-600">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/15 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">{t('assistant')}</h1>
            <p className="text-white/75 text-xs sm:text-sm">DeepSeek AI</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2 sm:space-y-3">
        {messages.map(msg => (
          <ChatBubble key={msg.id} message={msg.message} isUser={msg.isUser} timestamp={msg.timestamp} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
              <LoadingSpinner size="sm" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 2 && (
        <div className="px-3 sm:px-4 pb-2 sm:pb-3 flex gap-1.5 sm:gap-2 flex-wrap">
          {QUICK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="px-3 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium active:bg-primary/20"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 safe-bottom">
        <div className="flex items-center justify-between pb-1.5 sm:pb-2">
          <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={handsFree}
              onClick={toggleHandsFree}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${handsFree ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${handsFree ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300">{t('handsFreeVoice')}</span>
          </label>
          {(listening || speaking) && (
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${listening ? 'bg-primary animate-pulse' : 'bg-teal-500 animate-pulse'}`} />
              {listening ? t('listening') : t('speaking')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleMicClick}
            aria-label={t('voiceInput')}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${listening ? 'bg-primary/15' : 'bg-gray-100 dark:bg-gray-800'}`}
          >
            <Mic size={20} className={`${listening ? 'text-primary animate-pulse' : speaking ? 'text-teal-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={t('messagePlaceholder')}
            className="flex-1 h-10 sm:h-12 px-3 sm:px-4 bg-gray-100 dark:bg-gray-800 rounded-full text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50"
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
        {voiceNotice && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{voiceNotice}</p>}
      </div>
    </div>
  )
}
