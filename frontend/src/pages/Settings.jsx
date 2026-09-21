import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { Store, Moon, Sun, Globe, LogOut } from 'lucide-react'
import { api } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'

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
    <div className="px-4 pt-6 pb-8 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('settings')}</h1>

      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Store size={20} className="text-primary" />
          </div>
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{t('shopName')}</h2>
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

      <Card className="mb-4 dark:bg-gray-800">
        <button onClick={toggleDark} className="w-full flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              {dark ? <Sun size={20} className="text-indigo-600 dark:text-indigo-400" /> : <Moon size={20} className="text-indigo-600" />}
            </div>
            <span className="font-medium text-gray-800 dark:text-gray-200">{t('darkMode')}</span>
          </div>
          <div className={`w-12 h-7 rounded-full transition-colors ${dark ? 'bg-primary' : 'bg-gray-300'} relative`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${dark ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </button>
      </Card>

      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Globe size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <span className="font-medium text-gray-800 dark:text-gray-200">{t('language')}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLang('en')}
            className={`flex-1 h-12 rounded-xl font-medium text-base transition-colors ${lang === 'en' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            {t('english')}
          </button>
          <button
            onClick={() => setLang('ne')}
            className={`flex-1 h-12 rounded-xl font-medium text-base transition-colors ${lang === 'ne' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            {t('nepali')}
          </button>
        </div>
      </Card>

      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-lg">🏪</span>
          </div>
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200">Kirana Smart</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('version')} 1.0.0</p>
          </div>
        </div>
      </Card>

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
