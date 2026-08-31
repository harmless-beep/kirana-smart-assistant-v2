import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, Users } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isEdit = !!id

  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCustomer = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.customers.getById(id)
      const c = res.data?.customer || res.data
      setForm({ name: c.name || '', phone: c.phone || '', address: c.address || '' })
    } catch {
      navigate('/khata')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    if (isEdit) loadCustomer()
  }, [isEdit, loadCustomer])

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('customerNameRequired')); return }
    if (!form.phone.trim()) { setError(t('phoneRequired')); return }

    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await api.customers.update(id, form)
      } else {
        await api.customers.create(form)
      }
      navigate('/khata')
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8">
      <PageHeader icon={Users} title={isEdit ? t('editCustomer') : t('addCustomer')} onBack={() => navigate(-1)} />

      {loading ? (
        <div className="flex items-center justify-center py-12"><p className="text-gray-500 text-lg">{t('loading')}</p></div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('customerName')} *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateForm('name', e.target.value)}
              placeholder={t('customerName')}
              className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('phoneNumber')} *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => updateForm('phone', e.target.value)}
              placeholder="9841234567"
              className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={e => updateForm('address', e.target.value)}
              placeholder={t('address')}
              className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-3">
              <p className="text-red-600 dark:text-red-400 text-base">{error}</p>
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={saving} icon={Save}>
            {isEdit ? t('updateCustomer') : t('addCustomer')}
          </Button>
        </form>
      )}
    </div>
  )
}
