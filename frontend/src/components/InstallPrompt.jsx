import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISSED_KEY = 'kirana-install-prompt-dismissed'

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null)
  const [visible, setVisible] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    // Installed PWAs should not prompt again.
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone
    if (standalone || localStorage.getItem(DISMISSED_KEY) === '1') return undefined

    // Show our own prompt even where the browser does not expose
    // beforeinstallprompt (notably iOS Safari). The button then displays the
    // platform instructions instead of silently doing nothing.
    const showTimer = window.setTimeout(() => setVisible(true), 1200)

    const onBeforeInstall = event => {
      event.preventDefault()
      setInstallEvent(event)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => {
      window.clearTimeout(showTimer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  if (!visible || !installEvent) return null

  async function install() {
    if (!installEvent) {
      setShowHelp(true)
      return
    }
    installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
    setVisible(false)
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="fixed left-4 right-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-gray-900 p-4 text-white shadow-2xl dark:bg-gray-100 dark:text-gray-900">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/20 p-2 text-primary"><Download size={22} /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Use Kirana as an app</p>
          <p className="mt-1 text-sm text-gray-300 dark:text-gray-600">Add it to your home screen for faster access and an app-like experience.</p>
          <button type="button" onClick={install} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">{installEvent ? 'Add to Home screen' : 'How to install'}</button>
          {showHelp && <p className="mt-2 text-xs text-gray-300 dark:text-gray-600">Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>}
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="rounded-lg p-1 text-gray-400 hover:text-white dark:hover:text-gray-900"><X size={18} /></button>
      </div>
    </div>
  )
}
