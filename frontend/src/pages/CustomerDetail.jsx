import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, CreditCard, IndianRupee, Calendar, Edit3, Trash2, Check, Users } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import PageHeader from '../components/PageHeader'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const [customer, setCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [custRes, creditRes] = await Promise.allSettled([
        api.customers.getById(id),
        api.customers.getCredits(id),
      ])
      if (custRes.status === 'fulfilled') {
        const nextCustomer = custRes.value.data?.customer || custRes.value.data
        setCustomer(nextCustomer)
        setNewName(nextCustomer?.name || '')
      }
      if (creditRes.status === 'fulfilled') setTransactions(creditRes.value.data?.credits || creditRes.value.data || [])
    } catch {
      navigate('/khata')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { loadData() }, [loadData])

  async function handleRename() {
    const name = newName.trim()
    if (!name) {
      setError(t('customerNameRequired'))
      return
    }

    setSavingName(true)
    setError('')
    try {
      const response = await api.customers.update(id, { name })
      setCustomer(response.data?.customer || response.data || { ...customer, name })
      setRenaming(false)
    } catch (err) {
      setError(err.response?.data?.detail || t('error'))
    } finally {
      setSavingName(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await api.customers.delete(id)
      navigate('/khata', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || t('error'))
      setDeleting(false)
      setShowDelete(false)
    }
  }

  if (loading) return <LoadingSpinner text={t('loadingCustomer')} />
  if (!customer) return null

  const balance = Number(customer.balance || customer.pending_credit || 0)
  const dateLocale = lang === 'ne' ? 'ne-NP' : 'en-US'

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8 dark:bg-gray-900 min-h-screen">
      <PageHeader
        icon={Users}
        title={t('customerDetails')}
        onBack={() => navigate(-1)}
        action={
          <button type="button" onClick={() => navigate(`/khata/${id}/edit`)} aria-label={t('editCustomer')} className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center active:bg-white/30 transition-colors">
            <Edit3 size={18} />
          </button>
        }
      />

      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">{(customer.name || '?')[0].toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{customer.name}</h2>
            <p className="text-base text-gray-500 dark:text-gray-400 flex items-center gap-1"><Phone size={16} /> {customer.phone}</p>
            {customer.address && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{customer.address}</p>}
          </div>
        </div>

        {renaming ? (
          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={event => setNewName(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && handleRename()}
              aria-label={t('customerName')}
              className="min-w-0 flex-1 h-11 px-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button icon={Check} loading={savingName} onClick={handleRename}>{t('save')}</Button>
            <Button variant="secondary" onClick={() => { setNewName(customer.name); setRenaming(false); setError('') }}>{t('cancel')}</Button>
          </div>
        ) : (
          <div className="flex gap-2 mb-4">
            <Button variant="secondary" fullWidth icon={Edit3} onClick={() => setRenaming(true)}>{t('rename')}</Button>
            <Button variant="ghost" fullWidth icon={Edit3} onClick={() => navigate(`/khata/${id}/edit`)}>{t('edit')}</Button>
          </div>
        )}

        <div className={`rounded-xl p-4 ${balance > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
          <p className="text-sm font-medium text-gray-600 mb-1">{t('balance')}</p>
          <p className={`text-3xl font-bold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {balance > 0 ? `Rs. ${balance.toLocaleString()}` : t('settled')}
          </p>
        </div>
      </Card>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl p-3 text-red-600 dark:text-red-400">{error}</div>}

      <div className="flex gap-3 mb-6">
        <Button variant="accent" fullWidth icon={IndianRupee} onClick={() => navigate(`/khata/${id}/credit`)}>{t('addCredit')}</Button>
        <Button variant="primary" fullWidth icon={CreditCard} onClick={() => navigate(`/khata/${id}/payment`)}>{t('addPayment')}</Button>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">{t('transactionHistory')}</h3>
        {transactions.length === 0 ? (
          <Card className="text-center py-6 dark:bg-gray-800">
            <Calendar size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-base">{t('noTransactions')}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((tx, index) => {
              const isPayment = tx.type === 'payment'
              return (
                <Card key={tx._id || tx.id || index}>
                  <div className="flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${isPayment ? 'bg-green-500' : 'bg-orange-500'}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPayment ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {isPayment ? t('paymentReceived') : t('creditGiven')}
                        </span>
                        <span className={`text-lg font-bold ${isPayment ? 'text-green-600' : 'text-orange-600'}`}>
                          {isPayment ? '+' : '-'} Rs. {Number(tx.amount || 0).toLocaleString()}
                        </span>
                      </div>
                      {tx.notes && <p className="text-sm text-gray-500 mt-1">{tx.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Button variant="danger" fullWidth icon={Trash2} onClick={() => setShowDelete(true)}>{t('deleteCustomer')}</Button>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t('deleteCustomer')}
        message={t('deleteCustomerMessage', { name: customer.name })}
        confirmText={deleting ? `${t('delete')}...` : t('delete')}
        danger
      />
    </div>
  )
}
