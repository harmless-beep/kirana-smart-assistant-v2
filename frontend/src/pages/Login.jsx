import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import { Store, Eye, EyeOff, Globe } from 'lucide-react'

export default function Login() {
  const { login, register } = useAuth()
  const { lang, toggleLang, t } = useLanguage()
  const [isRegister, setIsRegister] = useState(false)
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        if (!shopName.trim() || !ownerName.trim() || !phone.trim() || !password.trim()) {
          setError(lang === 'ne' ? 'सबै फिल्ड भर्नुहोस्' : 'Please fill in all fields')
          setLoading(false)
          return
        }
        await register(shopName.trim(), ownerName.trim(), phone.trim(), password)
      } else {
        if (!phone.trim() || !password.trim()) {
          setError(lang === 'ne' ? 'फोन र पासवर्ड प्रविष्ट गर्नुहोस्' : 'Please enter phone and password')
          setLoading(false)
          return
        }
        await login(phone.trim(), password)
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || t('error')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
      <button
        onClick={toggleLang}
        className="fixed top-4 right-4 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-soft flex items-center gap-2 text-gray-700 dark:text-gray-200"
      >
        <Globe size={20} />
        <span className="font-medium">{lang === 'en' ? 'नेपाली' : 'English'}</span>
      </button>

      <div className="mb-4 sm:mb-6 text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lift">
          <Store size={32} className="text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Kirana Smart</h1>
        <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg mt-1">{t('assistant')}</p>
        <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">
          {lang === 'ne' ? 'तपाईंको पसल, सधैं तपाईंको हातमा' : 'Your shop, always in your pocket'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-lift p-5 sm:p-6 flex flex-col gap-3 sm:gap-4">
        {isRegister && (
          <>
            <div>
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('shopName')}</label>
              <input
                type="text"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder={lang === 'ne' ? 'जस्तै: राम जनरल स्टोर' : 'e.g. Ram General Store'}
                className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('yourName')}</label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder={lang === 'ne' ? 'जस्तै: राम श्रेष्ठ' : 'e.g. Ram Shrestha'}
                className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:text-white"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('phone')}</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder={lang === 'ne' ? 'जस्तै: 9841234567' : 'e.g. 9841234567'}
            className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('password')}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={lang === 'ne' ? 'पासवर्ड प्रविष्ट गर्नुहोस्' : 'Enter your password'}
              className="w-full h-14 px-4 pr-12 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400"
            >
              {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl p-4">
            <p className="text-red-600 dark:text-red-400 text-base">{error}</p>
          </div>
        )}

        <Button type="submit" fullWidth size="lg" loading={loading}>
          {isRegister ? t('register') : t('login')}
        </Button>

        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError('') }}
          className="text-center text-base text-gray-500 dark:text-gray-400 mt-2"
        >
          {isRegister ? (
            <>{lang === 'ne' ? 'अघिल्लो खाता छ?' : 'Already have an account?'} <span className="text-primary font-semibold">{t('login')}</span></>
          ) : (
            <>{lang === 'ne' ? 'खाता छैन?' : "Don't have an account?"} <span className="text-primary font-semibold">{t('register')}</span></>
          )}
        </button>
      </form>
    </div>
  )
}
