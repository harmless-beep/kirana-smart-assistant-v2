import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Plus, ScanLine, BookOpen, Bot, TrendingUp, AlertTriangle, IndianRupee, Clock, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { formatBsDate } from '../utils/nepaliDate'
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
  const { t, lang } = useLanguage()
  const [summary, setSummary] = useState(null)
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => new Date())

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const [summaryRes, salesRes] = await Promise.allSettled([
        api.dashboard.getSummary(),
        api.sales.getAll({ limit: 5 }),
      ])
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data)
      if (salesRes.status === 'fulfilled') setRecentSales(salesRes.value.data?.sales || salesRes.value.data || [])
    } catch {
      if (!silent) setError(t('error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Keep the clock ticking every minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Keep today's numbers fresh: a sale made on another device shows up
  // here automatically without a manual reload.
  usePolling(() => loadDashboard(true), 30000)

  if (loading) return <LoadingSpinner size="lg" text={t('loading')} />

  const todaySales = summary?.today_sales ?? summary?.todaySales ?? 0
  const todayProfit = summary?.today_profit ?? summary?.todayProfit ?? 0
  const lowStockCount = summary?.low_stock_count ?? summary?.lowStockCount ?? 0
  const pendingCredit = summary?.pending_credit ?? summary?.pendingCredit ?? 0

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 dark:bg-gray-900">
      <div className="mb-4 sm:mb-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-emerald-600 to-teal-600 p-4 sm:p-5 text-white shadow-lift">
        <p className="text-white/85 text-sm sm:text-base">{getGreeting(t)},</p>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5 truncate">{user?.shop_name || user?.shopName || user?.name || t('shopName')}!</h1>
        <p className="text-white/70 text-xs sm:text-sm mt-1.5 flex items-center gap-1.5">
          <CalendarDays size={14} />
          <span>{formatBsDate(now, lang)}</span>
          <span className="text-white/50">•</span>
          <Clock size={14} />
          <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
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

      <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 mb-2 sm:mb-3">{t('quickActions')}</h2>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Link to="/sales/new">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Plus size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">{t('newSale')}</span>
          </Card>
        </Link>
        <Link to="/products">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ScanLine size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">{t('scanShelf')}</span>
          </Card>
        </Link>
        <Link to="/products/new">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <ShoppingBag size={24} className="text-orange-600 dark:text-orange-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">{t('addProduct')}</span>
          </Card>
        </Link>
        <Link to="/khata">
          <Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BookOpen size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">{t('openKhata')}</span>
          </Card>
        </Link>
        <Link to="/assistant" className="col-span-2">
          <Card className="flex items-center gap-3 py-4 dark:bg-gray-800">
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Bot size={24} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base block">{t('askAssistant')}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('askAnything')}</span>
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
          <Card className="text-center py-8 dark:bg-gray-800">
            <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <Clock size={26} className="text-green-500 dark:text-green-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-base">{t('noSalesToday')}</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">{t('startFirstSale')}</p>
            <Link to="/sales/new" className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl shadow-soft active:scale-[0.98] transition-transform">
              <Plus size={16} /> {t('newSale')}
            </Link>
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
