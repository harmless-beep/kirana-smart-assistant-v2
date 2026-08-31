import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { Store, Moon, Sun, Globe, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { api } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'
import PageHeader from '../components/PageHeader'

// Warm the lazy-loaded JCode demo chunk before the user actually navigates,
// so the demo page appears instantly. Dynamic imports are cached, so calling
// this repeatedly (hover, focus, touch) is a no-op after the first fetch.
const preloadJcodeDemo = () => import('./JcodeDemo').catch(() => {})

export default function Settings() {
  const { user, logout, updateUser } = useAuth()
  const { dark, toggleDark } = useTheme()
  const { lang, setLang, t } = useLanguage()
  const [shopName, setShopName] = useState(user?.shop_name || user?.shopName || '')
  const [ownerName, setOwnerName] = useState(user?.name || user?.ownerName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveProfile() {
    setSaving(true)
    try {
      const response = await api.auth.updateProfile({ shop_name: shopName, name: ownerName, phone })
      updateUser(response.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8 dark:bg-gray-900 min-h-screen">
      <PageHeader
        icon={SettingsIcon}
        title={t('settings')}
        subtitle={user?.shop_name || user?.shopName || user?.name}
      />

      {/* Shop profile */}
      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Store size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-lg leading-tight">
              {lang === 'ne' ? 'पसल जानकारी' : 'Shop details'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lang === 'ne' ? 'आफ्नो पसलको जानकारी मिलाउनुहोस्' : 'Keep your shop information up to date'}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('shopName')}</label>
            <input
              type="text"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              className="w-full h-12 px-4 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('yourName')}</label>
            <input
              type="text"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              className="w-full h-12 px-4 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full h-12 px-4 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
            />
          </div>
          <Button onClick={handleSaveProfile} loading={saving} fullWidth>
            {saved ? (lang === 'ne' ? 'सेभ भयो!' : 'Saved!') : t('save')}
          </Button>
        </div>
      </Card>

      {/* Preferences: dark mode + language in one tidy card */}
      <Card className="mb-4 dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              {dark ? <Sun size={20} className="text-indigo-600 dark:text-indigo-400" /> : <Moon size={20} className="text-indigo-600" />}
            </div>
            <span className="font-medium text-gray-800 dark:text-gray-200">{t('darkMode')}</span>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={t('darkMode')}
            className={`w-12 h-7 rounded-full transition-colors ${dark ? 'bg-primary' : 'bg-gray-300'} relative flex-shrink-0`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${dark ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Globe size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="font-medium text-gray-800 dark:text-gray-200">{t('language')}</span>
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 h-8 rounded-lg font-medium text-sm transition-colors ${lang === 'en' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {t('english')}
            </button>
            <button
              type="button"
              onClick={() => setLang('ne')}
              className={`px-3 h-8 rounded-lg font-medium text-sm transition-colors ${lang === 'ne' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {t('nepali')}
            </button>
          </div>
        </div>
      </Card>

      {/* About */}
      <Link
        to="/jcode-demo"
        className="block"
        onMouseEnter={preloadJcodeDemo}
        onFocus={preloadJcodeDemo}
        onTouchStart={preloadJcodeDemo}
      >
        <Card className="mb-4 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
              <Store size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 dark:text-gray-200">Kirana Smart Assistant</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('version')} 1.0.0</p>
              <p className="text-xs text-primary font-medium mt-0.5">Try the jcode-tools demo →</p>
            </div>
            <span className="text-xl" aria-hidden="true">🧡</span>
          </div>
        </Card>
      </Link>

      <button
        onClick={logout}
        className="w-full h-14 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-center gap-3 text-red-600 dark:text-red-400 font-semibold text-base active:bg-red-100 dark:active:bg-red-900/40"
      >
        <LogOut size={20} />
        {t('logout')}
      </button>
    </div>
  )
}
