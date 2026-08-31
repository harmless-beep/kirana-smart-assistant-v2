import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { IndianRupee, TrendingUp, ShoppingCart, BarChart3 } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'

export default function Dashboard() {
  const { t } = useLanguage()
  const [period, setPeriod] = useState('today')
  const [summary, setSummary] = useState(null)
  const [weeklyData, setWeeklyData] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [period])

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    try {
      const [summaryRes, weeklyRes, lowStockRes, topRes] = await Promise.allSettled([
        api.dashboard.getSummary(),
        api.dashboard.getWeekly(),
        api.products.getLowStock(),
        api.sales.getTopProducts(),
      ])
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data)
      if (weeklyRes.status === 'fulfilled') setWeeklyData(weeklyRes.value.data?.weekly || weeklyRes.value.data || [])
      if (lowStockRes.status === 'fulfilled') setLowStock(lowStockRes.value.data?.products || lowStockRes.value.data || [])
      if (topRes.status === 'fulfilled') setTopProducts(topRes.value.data?.products || topRes.value.data || [])
    } catch {
      // silent
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Keep the report fresh without a manual reload.
  usePolling(() => loadData(true), 30000)

  if (loading) return <LoadingSpinner text={t('loading')} />

  const todaySales = summary?.today_sales ?? summary?.todaySales ?? 0
  const todayProfit = summary?.today_profit ?? summary?.todayProfit ?? 0
  const orderCount = summary?.order_count ?? summary?.orderCount ?? 0
  const pendingCredit = summary?.pending_credit ?? summary?.pendingCredit ?? 0

  const maxSales = Math.max(...weeklyData.map(d => d.sales || 0), 1)

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8 dark:bg-gray-900 min-h-screen">
      <PageHeader icon={BarChart3} title={t('todaysReport')} />

      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-5">
        {[
          { key: 'today', label: t('today') },
          { key: 'week', label: t('thisWeek') },
          { key: 'month', label: t('thisMonth') },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              period === p.key ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard title={t('totalSales')} value={`Rs. ${todaySales.toLocaleString()}`} icon={IndianRupee} color="green" />
        <StatCard title={t('totalProfit')} value={`Rs. ${todayProfit.toLocaleString()}`} icon={TrendingUp} color="blue" />
        <StatCard title={t('orders')} value={orderCount} icon={ShoppingCart} color="purple" />
        <StatCard title={t('pending')} value={`Rs. ${pendingCredit.toLocaleString()}`} icon={IndianRupee} color="orange" />
      </div>

      {weeklyData.length > 0 && (
        <Card className="mb-5 dark:bg-gray-800">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('weeklySales')}</h3>
          <div className="flex items-end gap-2 h-32">
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-primary/20 rounded-t-lg relative" style={{ height: `${((d.sales || 0) / maxSales) * 100}%`, minHeight: '4px' }}>
                  <div className="absolute bottom-0 w-full bg-primary rounded-t-lg" style={{ height: '100%' }} />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{d.day || d.date?.slice(0, 3) || ''}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card className="mb-5 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('lowStock')}</h3>
            <Link to="/products" className="text-primary text-sm font-medium">{t('seeAll')}</Link>
          </div>
          <div className="flex flex-col gap-2">
            {lowStock.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                <span className={`text-sm font-semibold ${item.quantity <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                  {item.quantity <= 0 ? t('outOfStock') : `${item.quantity} ${t('left')}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {topProducts.length > 0 && (
        <Card className="dark:bg-gray-800">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('topProducts')}</h3>
          <div className="flex flex-col gap-2">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{i + 1}</span>
                  <span className="text-gray-700 dark:text-gray-300">{p.name || p.product_name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{p.total_sold || p.quantity} {t('sold')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
