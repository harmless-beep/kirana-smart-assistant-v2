import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, Phone } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { hapticImpact } from '../utils/haptics'
import { api } from '../api/client'
import SearchBar from '../components/SearchBar'
import Card from '../components/Card'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'

export default function Khata() {
  const { t } = useLanguage()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [totalPending, setTotalPending] = useState(0)

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    setLoading(true)
    try {
      const res = await api.customers.getAll()
      const list = res.data?.customers || res.data || []
      setCustomers(list)
      const total = list.reduce((sum, c) => sum + (c.balance || c.pending_credit || 0), 0)
      setTotalPending(total)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  const handleRefresh = useCallback(async () => {
    hapticImpact()
    await loadCustomers()
  }, [])

  const { containerProps, refreshing, showIndicator, pullDistance } = usePullToRefresh(handleRefresh)

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 dark:bg-gray-900 min-h-screen" {...containerProps}>
      <PullToRefreshIndicator refreshing={refreshing} pullDistance={pullDistance} />
      <PageHeader
        icon={Users}
        title={t('khata')}
        subtitle={customers.length > 0 ? `${customers.length} ${t('customer')}` : undefined}
        action={
          <Link to="/khata/new">
            <Button variant="white" icon={Plus} size="md">{t('add')}</Button>
          </Link>
        }
      />

      <SearchBar value={search} onChange={setSearch} placeholder={t('searchCustomers')} />

      {!loading && customers.length > 0 && (
        <Card className="mb-4 bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('totalPending')}</span>
            <span className="text-xl font-bold text-primary">Rs. {totalPending.toLocaleString()}</span>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingSpinner text={t('loading')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('noCustomers')}
          description={t('addFirstCustomer')}
          action={
            <Link to="/khata/new">
              <Button>{t('addCustomer')}</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(customer => {
            const balance = customer.balance || customer.pending_credit || 0
            return (
              <Link key={customer.id} to={`/khata/${customer.id}`}>
                <Card className="dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{customer.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-base">{customer.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Phone size={14} /> {customer.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {balance > 0 ? (
                        <p className="font-bold text-red-600 dark:text-red-400 text-lg">Rs. {balance.toLocaleString()}</p>
                      ) : (
                        <p className="font-bold text-green-600 dark:text-green-400 text-lg">Rs. 0</p>
                      )}
                      <p className="text-xs text-gray-400">{balance > 0 ? t('pending') : t('settled')}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
