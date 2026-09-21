import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Plus, ScanLine, BookOpen, Wrench, TrendingUp, AlertTriangle, IndianRupee, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../api/client'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'

function getGreeting(t) {
  const hour = new Date().getHours()
  if (hour < 12) return t('goodMorning')
  if (hour < 17) return t('goodAfternoon')
  return t('goodEvening')
}

export default function Home() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [summary, setSummary] = useState(null)
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const [summaryRes, salesRes] = await Promise.allSettled([
        api.dashboard.getSummary(),
        api.sales.getAll({ limit: 5 }),
      ])
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data)
      if (salesRes.status === 'fulfilled') setRecentSales(salesRes.value.data?.sales || salesRes.value.data || [])
    } catch {
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (loading) return <LoadingSpinner size="lg" text={t('loading')} />

  const todaySales = summary?.today_sales ?? summary?.todaySales ?? 0
  const todayProfit = summary?.today_profit ?? summary?.todayProfit ?? 0
  const lowStockCount = summary?.low_stock_count ?? summary?.lowStockCount ?? 0
  const pendingCredit = summary?.pending_credit ?? summary?.pendingCredit ?? 0

  return (
    <div className="px-4 pt-6 dark:bg-gray-900">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-base">{getGreeting(t)},</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user?.shop_name || user?.shopName || user?.name || t('shopName')}!</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard title={t('todaysSales')} value={`Rs. ${todaySales.toLocaleString()}`} icon={IndianRupee} color="green" />
        <StatCard title={t('todaysProfit')} value={`Rs. ${todayProfit.toLocaleString()}`} icon={TrendingUp} color="blue" />
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {lowStockCount > 0 && (
          <Link to="/products">
            <Card variant="warning" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-semibold text-orange-800 dark:text-orange-300">{lowStockCount} {t('productsRunningLow')}</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">{t('tapToView')}</p>
              </div>
            </Card>
          </Link>
        )}
        {pendingCredit > 0 && (
          <Link to="/khata">
            <Card variant="danger" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <IndianRupee size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">Rs. {pendingCredit.toLocaleString()} {t('pendingCredit')}</p>
                <p className="text-sm text-red-600 dark:text-red-400">{t('tapToView')}</p>
              </div>
            </Card>
          </Link>
        )}
      </div>

      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">{t('quickActions')}</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link to="/sales/new">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Plus size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-base">{t('newSale')}</span>
          </Card>
        </Link>
        <Link to="/products">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ScanLine size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-base">{t('scanShelf')}</span>
          </Card>
        </Link>
        <Link to="/products/new">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <ShoppingBag size={24} className="text-orange-600 dark:text-orange-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-base">{t('addProduct')}</span>
          </Card>
        </Link>
        <Link to="/khata">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BookOpen size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-base">{t('openKhata')}</span>
          </Card>
        </Link>
        <Link to="/tools" className="col-span-2">
          <Card className="flex items-center gap-3 py-4 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Wrench size={24} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-base block">{t('shopTools')}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('toolsSubtitle')}</span>
            </div>
          </Card>
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('recentSales')}</h2>
          <Link to="/sales/history" className="text-primary text-base font-medium">{t('seeAll')}</Link>
        </div>
        {recentSales.length === 0 ? (
          <Card className="text-center py-6 dark:bg-gray-800">
            <Clock size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-base">{t('noSalesToday')}</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">{t('startFirstSale')}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSales.map(sale => (
              <Card key={sale._id || sale.id} className="flex items-center justify-between dark:bg-gray-800">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-base">{sale.customer_name || sale.customerName || t('cash')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{sale.items?.length || 0} {t('items')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white text-lg">Rs. {(sale.total_amount || sale.total || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {sale.created_at || sale.createdAt ? new Date(sale.created_at || sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl p-4 mb-4">
          <p className="text-red-600 dark:text-red-400 text-base">{error}</p>
          <button onClick={loadDashboard} className="text-primary font-semibold text-base mt-1">{t('retry')}</button>
        </div>
      )}
    </div>
  )
}
