import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Save, IndianRupee, CreditCard } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'

export default function CreditForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()

  // HashRouter keeps routes in location.hash, so window.location.pathname is
  // always the GitHub Pages project path. Use the router location instead.
  const isPayment = location.pathname.endsWith('/payment')
  const type = isPayment ? 'payment' : 'credit'

  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const numpadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

  function handleNumpadKey(key) {
    if (key === '⌫') {
      setAmount(prev => prev.slice(0, -1))
    } else if (key === '.') {
      if (!amount.includes('.')) setAmount(prev => prev + '.')
    } else {
      setAmount(prev => prev + key)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError(t('validAmount'))
      return
    }

    setSaving(true)
    setError('')
    try {
      const data = { amount: parsedAmount, notes, date, type }
      if (isPayment) {
        await api.customers.addPayment(id, data)
      } else {
        await api.customers.addCredit(id, data)
      }
      navigate(`/khata/${id}`)
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8">
      <PageHeader
        icon={IndianRupee}
        title={isPayment ? t('addPayment') : t('addCredit')}
        onBack={() => navigate(-1)}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Type Toggle */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => navigate(`/khata/${id}/credit`, { replace: true })}
            className={`flex-1 h-12 rounded-lg text-base font-semibold flex items-center justify-center gap-2 transition-colors ${
              !isPayment ? 'bg-orange-500 text-white' : 'text-gray-600'
            }`}
          >
            <IndianRupee size={18} /> {t('creditGiven')}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/khata/${id}/payment`, { replace: true })}
            className={`flex-1 h-12 rounded-lg text-base font-semibold flex items-center justify-center gap-2 transition-colors ${
              isPayment ? 'bg-green-500 text-white' : 'text-gray-600'
            }`}
          >
            <CreditCard size={18} /> {t('paymentReceived')}
          </button>
        </div>

        {/* Amount Display */}
        <div className={`text-center py-6 rounded-2xl ${isPayment ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
          <p className="text-sm text-gray-500 mb-1">{t('amount')}</p>
          <p className={`text-4xl font-bold ${isPayment ? 'text-green-600' : 'text-orange-600'}`}>
            Rs. {amount || '0'}
          </p>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {numpadDigits.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => handleNumpadKey(key)}
              className={`h-14 rounded-xl text-xl font-semibold active:scale-95 transition-transform ${
                key === '⌫'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Date */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('date')}</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:text-white"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes')}</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('anyNotes')}
            rows={2}
            className="w-full px-4 py-3 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white resize-none"
          />
        </div>          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-3">
              <p className="text-red-600 dark:text-red-400 text-base">{error}</p>
            </div>
          )}

        <Button type="submit" fullWidth size="lg" loading={saving} icon={Save}>
          {isPayment ? t('recordPayment') : t('recordCredit')}
        </Button>
      </form>
    </div>
  )
}
