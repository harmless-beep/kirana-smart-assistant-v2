import { useEffect, useRef, useState } from 'react'
import {
  FileCode2,
  Terminal,
  Play,
  Trash2,
  Boxes,
  ShieldAlert,
  Zap,
  Database,
  Cloud,
} from 'lucide-react'
import { logger, getCustomCode, CodeXClient, Storage } from 'jcode-tools'
import { useLanguage } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'

const STR = {
  en: {
    subtitle: 'jcode-tools v0.11.3 · live demo',
    loggerTitle: 'Console logger',
    loggerDesc: 'logger(container) returns a console-like object that renders on the page',
    runDemo: 'Run demo',
    clear: 'Clear',
    exportsTitle: 'Named exports',
    worksHere: 'Works here',
    sandboxOnly: 'Sandbox only',
    exportsDesc: {
      logger: 'Renders console output into any DOM container',
      getCustomCode: 'Reads the code text in custom Script mode',
      codex: 'Runs server-side code (sync & async)',
      storage: 'Simple KV storage backed by the sandbox server',
      getURL: 'Resolves asset URLs inside the playground',
    },
    sandboxTitle: 'Sandbox-only APIs',
    sandboxDesc: "These need Juejin's 码上掘金 playground — tap to see what happens here",
    sandboxNote:
      'Results are logged into the console above. On a real 码上掘金 pen, getCustomCode returns your code, CodeXClient runs server-side snippets, and Storage persists KV data.',
    footer: 'jcode-tools by xitu (Juejin) · MIT · built for the 码上掘金 playground',
    demoHello: 'Hello %c jcode-tools v0.11.3',
    demoInfo: 'Live demo — logging straight into a real DOM container',
    demoWarn: 'Low stock: Noodles — only 12 packets left',
    demoError: 'Payment gateway timeout — will retry automatically',
    demoGroup: 'Today at the shop',
    demoSales: 'Sales: Rs. 12,400',
    demoProfit: 'Profit: Rs. 3,260',
    qaLog: 'A plain log message from a chip button',
    qaWarn: 'Careful — something needs attention',
    qaError: 'Something went wrong',
    qaGroup: 'Group',
    qaGroupNested: 'Nested message inside the group',
    ccAlready:
      'getCustomCode() → already checked. It polls forever outside the 码上掘金 sandbox, so this demo runs it once.',
    ccNotFound:
      'getCustomCode() → found nothing. It waits for a text/* script, which only exists inside the 码上掘金 sandbox.',
    storageUnreachable:
      'Storage → unreachable. Its KV server is sandbox-only — it works inside 码上掘金.',
    storageSetFailed: 'Storage → set failed',
    codexUnreachable: 'CodeXClient → cannot reach the code-run server outside the sandbox.',
  },
  ne: {
    subtitle: 'jcode-tools v0.11.3 · प्रत्यक्ष प्रदर्शन',
    loggerTitle: 'कन्सोल लगर',
    loggerDesc: 'logger(container) ले कन्सोलजस्तै वस्तु फर्काउँछ जसले पृष्ठमै आउटपुट देखाउँछ',
    runDemo: 'डेमो चलाउनुहोस्',
    clear: 'खाली गर्नुहोस्',
    exportsTitle: 'नामसहित एक्सपोर्टहरू',
    worksHere: 'यहाँ चल्छ',
    sandboxOnly: 'स्यान्डबक्समा मात्र',
    exportsDesc: {
      logger: 'कुनै पनि DOM कन्टेनरमा कन्सोल आउटपुट देखाउँछ',
      getCustomCode: 'कस्टम स्क्रिप्ट मोडमा कोड पाठ पढ्छ',
      codex: 'सर्भर-साइड कोड चलाउँछ (सिङ्क र एसिङ्क)',
      storage: 'स्यान्डबक्स सर्भरमा सरल KV स्टोरेज',
      getURL: 'प्लेग्राउन्डभित्र एसेट URL पत्ता लगाउँछ',
    },
    sandboxTitle: 'स्यान्डबक्स-मात्र API',
    sandboxDesc: 'यिनलाई Juejin को 码上掘金 प्लेग्राउन्ड चाहिन्छ — यहाँ के हुन्छ हेर्न ट्याप गर्नुहोस्',
    sandboxNote:
      'नतिजा माथिको कन्सोलमा देखिन्छन्। वास्तविक 码上掘金 पेनमा getCustomCode ले तपाईंको कोड फर्काउँछ, CodeXClient ले सर्भर-साइड स्निपेट चलाउँछ, र Storage ले KV डाटा सुरक्षित राख्छ।',
    footer: 'jcode-tools by xitu (Juejin) · MIT · 码上掘金 प्लेग्राउन्डका लागि बनाइएको',
    demoHello: 'Hello %c jcode-tools v0.11.3',
    demoInfo: 'प्रत्यक्ष डेमो — वास्तविक DOM कन्टेनरमा लगिङ',
    demoWarn: 'स्टक कम: चाउचाउ — १२ प्याकेट मात्र बाँकी',
    demoError: 'भुक्तानी गेटवे समयसीमा — आफैं फेरि प्रयास गर्नेछ',
    demoGroup: 'आज पसलमा',
    demoSales: 'बिक्री: रु. १२,४००',
    demoProfit: 'नाफा: रु. ३,२६०',
    qaLog: 'चिप बटनबाट एउटा सामान्य लग सन्देश',
    qaWarn: 'होसियार — केहीमा ध्यान चाहिन्छ',
    qaError: 'केही गडबडी भयो',
    qaGroup: 'समूह',
    qaGroupNested: 'समूहभित्रको नेस्टेड सन्देश',
    ccAlready:
      'getCustomCode() → पहिले नै जाँच भयो। यो 码上掘金 स्यान्डबक्सबाहिर सधैं पोल गर्छ, त्यसैले यो डेमोले एक पटक मात्र चलाउँछ।',
    ccNotFound:
      'getCustomCode() → केही भेटिएन। यसले text/* स्क्रिप्ट पर्खन्छ, जुन 码上掘金 स्यान्डबक्सभित्र मात्र हुन्छ।',
    storageUnreachable:
      'Storage → पहुँच हुन सकेन। यसको KV सर्भर स्यान्डबक्स-मात्र हो — 码上掘金भित्र चल्छ।',
    storageSetFailed: 'Storage → सेभ गर्न सकिएन',
    codexUnreachable: 'CodeXClient → स्यान्डबक्सबाहिर कोड-रन सर्भरमा पहुँच हुन सकेन।',
  },
}

const EXPORTS = [
  { name: 'logger', descKey: 'logger', sandbox: false },
  { name: 'getCustomCode', descKey: 'getCustomCode', sandbox: true },
  { name: 'CodeXClient', descKey: 'codex', sandbox: true },
  { name: 'Storage', descKey: 'storage', sandbox: true },
  { name: 'getURL', descKey: 'getURL', sandbox: true },
]

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function JcodeDemo() {
  // Local-only language: start from the app's language but never change it
  // globally — toggling here only affects this demo page.
  const { lang: appLang } = useLanguage()
  const [lang, setLang] = useState(appLang)
  const S = STR[lang] || STR.en
  const outputRef = useRef(null)
  const logRef = useRef(null)
  const customCodeCheckedRef = useRef(false)
  const [busy, setBusy] = useState(null)

  // Create the logger and play the demo. Recreating the logger whenever the
  // language changes also resets its internal count()/time() state, so the
  // console output always looks fresh in the selected language.
  useEffect(() => {
    const container = outputRef.current
    if (!container) return
    const jlog = logger(container)
    logRef.current = jlog
    runSequence(jlog)
    return () => {
      logRef.current = null
      container.querySelector('.jcode-logger')?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  function runSequence(jlog) {
    if (!jlog) return
    jlog.clear()
    jlog.log(S.demoHello, 'color:#34d399;font-weight:700')
    jlog.info(S.demoInfo)
    jlog.warn(S.demoWarn)
    jlog.error(S.demoError)
    jlog.count('scan')
    jlog.count('scan')
    jlog.count('scan')
    jlog.time('render')
    // Only finish the timer if this logger is still the one on screen
    // (avoids writing to a detached node under StrictMode's double-mount).
    setTimeout(() => {
      if (logRef.current === jlog) jlog.timeEnd('render')
    }, 80)
    jlog.group(S.demoGroup)
    jlog.log(S.demoSales)
    jlog.log(S.demoProfit)
    jlog.groupEnd()
    jlog.dir({ shop: 'Bini Kirana', items: 128, lowStock: 4 })
    jlog.assert(1 === 2, '1 should equal 2')
    jlog.table([
      { item: 'Noodles', stock: 12, price: 30 },
      { item: 'Cooking oil', stock: 8, price: 210 },
      { item: 'Rice (1kg)', stock: 45, price: 95 },
    ])
  }

  function clearConsole() {
    logRef.current?.clear()
  }

  async function demoGetCustomCode() {
    setBusy('getCustomCode')
    // getCustomCode polls forever until it finds a text/* script, so it can
    // never be cancelled once started — run it at most once per page load.
    if (customCodeCheckedRef.current) {
      logRef.current?.warn(S.ccAlready)
      setBusy(null)
      return
    }
    customCodeCheckedRef.current = true
    try {
      const code = await withTimeout(getCustomCode(), 1500)
      logRef.current?.log('getCustomCode() →', code)
    } catch {
      logRef.current?.warn(S.ccNotFound)
    } finally {
      setBusy(null)
    }
  }

  async function demoStorage() {
    setBusy('storage')
    try {
      const storage = new Storage()
      const ok = await withTimeout(storage.set('jcode-demo', { ts: Date.now() }), 2500)
      if (ok) {
        const data = await withTimeout(storage.get('jcode-demo'), 2500)
        logRef.current?.log('Storage →', data)
        await withTimeout(storage.del('jcode-demo'), 2500)
      } else {
        logRef.current?.error('Storage →', storage.result?.error || S.storageSetFailed)
      }
    } catch {
      logRef.current?.warn(S.storageUnreachable)
    } finally {
      setBusy(null)
    }
  }

  async function demoCodeX() {
    setBusy('codex')
    try {
      const client = new CodeXClient()
      const result = await withTimeout(client.runCode({ input: ['1 1'] }), 2500)
      if (result.error) throw new Error(result.error)
      logRef.current?.log('CodeXClient →', result.output)
    } catch {
      logRef.current?.warn(S.codexUnreachable)
    } finally {
      setBusy(null)
    }
  }

  const quickActions = [
    { label: 'log()', run: c => c.log(S.qaLog) },
    { label: 'warn()', run: c => c.warn(S.qaWarn) },
    { label: 'error()', run: c => c.error(S.qaError) },
    {
      label: 'table()',
      run: c => c.table([
        { item: 'Noodles', stock: 12, price: 30 },
        { item: 'Cooking oil', stock: 8, price: 210 },
        { item: 'Rice (1kg)', stock: 45, price: 95 },
      ]),
    },
    {
      label: 'dir()',
      run: c => c.dir({ name: 'Bini Kirana', sales: 12400, profit: 3260 }),
    },
    {
      label: 'group()',
      run: c => {
        c.group(S.qaGroup)
        c.log(S.qaGroupNested)
        c.groupEnd()
      },
    },
  ]

  const sandboxDemos = [
    { id: 'getCustomCode', label: 'getCustomCode()', icon: Zap, onClick: demoGetCustomCode },
    { id: 'storage', label: 'Storage.set()', icon: Database, onClick: demoStorage },
    { id: 'codex', label: 'CodeXClient.runCode()', icon: Cloud, onClick: demoCodeX },
  ]

  return (
    <div className="px-4 pt-6 pb-10 dark:bg-gray-900 min-h-screen">
      {/* Scoped dark-console overrides so the logger's light-theme output stays readable */}
      <style>{`
        .jcode-demo-console { color: #e6edf3; }
        .jcode-demo-console .jcode-logger pre { overflow-x: auto; }
        .jcode-demo-console .jcode-logger__warn { background: #3a3211; }
        .jcode-demo-console .jcode-logger__error { background: #3d1f1c; }
        .jcode-demo-console .jcode-logger__group > div { color: #e6edf3; }
        .jcode-demo-console .jcode-logger__dir { color: #e6edf3; }
        .jcode-demo-console .jcode-logger__dir em { color: #9fb2c8; }
        .jcode-demo-console table.jcode-logger__table { border-color: #30363d; }
        .jcode-demo-console .jcode-logger__table th { background: #21262d; color: #e6edf3; }
        .jcode-demo-console .jcode-logger__table th:hover { background: #2d333b; }
        .jcode-demo-console .jcode-logger__table td,
        .jcode-demo-console .jcode-logger__table th { border-color: #30363d; }
        .jcode-demo-console .jcode-logger__table tr:nth-child(2n) { background: #161b22; }
        .jcode-demo-console .jcode-logger .string { color: #a5d6ff; }
        .jcode-demo-console .jcode-logger .number,
        .jcode-demo-console .jcode-logger .boolean { color: #79c0ff; }
        .jcode-demo-console .jcode-logger .null,
        .jcode-demo-console .jcode-logger .undefined { color: #8b949e; }
        .jcode-demo-console .jcode-logger .regexp,
        .jcode-demo-console .jcode-logger .symbol { color: #f2cc60; }
        .jcode-demo-console .jcode-logger .bigint,
        .jcode-demo-console .jcode-logger .array { color: #d2a8ff; }
      `}</style>

      <PageHeader
        icon={FileCode2}
        title="JCode Tools"
        subtitle={S.subtitle}
        action={
          <div className="flex gap-1 p-1 bg-black/15 rounded-xl" role="group" aria-label="Language">
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              className={`px-3 h-8 rounded-lg text-sm font-semibold transition-colors ${
                lang === 'en' ? 'bg-white text-primary shadow-sm' : 'text-white/80 active:bg-white/10'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ne')}
              aria-pressed={lang === 'ne'}
              className={`px-3 h-8 rounded-lg text-sm font-semibold transition-colors ${
                lang === 'ne' ? 'bg-white text-primary shadow-sm' : 'text-white/80 active:bg-white/10'
              }`}
            >
              ने
            </button>
          </div>
        }
      />

      {/* Console logger */}
      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="w-11 h-11 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Terminal size={22} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-lg leading-tight">
              {S.loggerTitle}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{S.loggerDesc}</p>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-[#0d1117]">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-[#21262d]">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-mono text-gray-400">
              <Terminal size={13} /> jcode-tools · logger
            </span>
          </div>
          <div
            ref={outputRef}
            className="jcode-demo-console max-h-80 overflow-y-auto p-3 text-[13px] leading-relaxed font-mono"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <Button icon={Play} onClick={() => runSequence(logRef.current)}>
            {S.runDemo}
          </Button>
          <Button variant="secondary" icon={Trash2} onClick={clearConsole}>
            {S.clear}
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap mt-3">
          {quickActions.map(action => (
            <button
              key={action.label}
              type="button"
              onClick={() => action.run(logRef.current)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-mono font-medium text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Named exports */}
      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Boxes size={22} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-lg leading-tight">
              {S.exportsTitle}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              import {'{ logger, getCustomCode, CodeXClient, Storage, getURL }'} from 'jcode-tools'
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {EXPORTS.map(exp => (
            <li key={exp.name} className="flex items-center gap-3">
              <span className="w-28 flex-shrink-0 font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">
                {exp.name}
              </span>
              <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 min-w-0">
                {S.exportsDesc[exp.descKey]}
              </span>
              <span
                className={`flex-shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${
                  exp.sandbox
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}
              >
                {exp.sandbox ? S.sandboxOnly : S.worksHere}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Sandbox-only APIs */}
      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ShieldAlert size={22} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-lg leading-tight">
              {S.sandboxTitle}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{S.sandboxDesc}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {sandboxDemos.map(({ id, label, icon: Icon, onClick }) => (
            <button
              key={id}
              type="button"
              onClick={onClick}
              disabled={!!busy}
              className="flex-1 min-w-0 h-20 rounded-xl bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              <Icon
                size={18}
                className={busy === id ? 'animate-pulse text-primary' : 'text-gray-500 dark:text-gray-400'}
              />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{S.sandboxNote}</p>
      </Card>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">{S.footer}</p>
    </div>
  )
}
