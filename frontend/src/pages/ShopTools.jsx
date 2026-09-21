import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, CreditCard, ClipboardList, PackagePlus, Plus, RefreshCw, ShoppingCart, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'

function list(data) {
  return Array.isArray(data) ? data : (data?.items || [])
}

export default function ShopTools() {
  const { t } = useLanguage()
  const [alerts, setAlerts] = useState({ lowStock: [], expiring: [], overdue: [] })
  const [summary, setSummary] = useState(null)
  const [restock, setRestock] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [lowStock, expiring, overdue, dashboard, products, sales] = await Promise.allSettled([
      api.products.getLowStock(),
      api.products.getExpiring(),
      api.customers.getOverdue(),
      api.dashboard.getSummary(),
      api.products.getAll(),
      api.sales.getAll(),
    ])
    setAlerts({
      lowStock: lowStock.status === 'fulfilled' ? list(lowStock.value.data) : [],
      expiring: expiring.status === 'fulfilled' ? list(expiring.value.data) : [],
      overdue: overdue.status === 'fulfilled' ? list(overdue.value.data) : [],
    })
    if (dashboard.status === 'fulfilled') setSummary(dashboard.value.data)
    if (products.status === 'fulfilled' && sales.status === 'fulfilled') {
      const productList = list(products.value.data)
      const saleList = list(sales.value.data)
      const sold = new Map()
      saleList.forEach(sale => (sale.items || []).forEach(item => {
        const id = String(item.product_id ?? item.productId ?? '')
        sold.set(id, (sold.get(id) || 0) + Number(item.quantity || 0))
      }))
      // Recommend a seven-day buffer based on the last 30 days of sales.
      setRestock(productList.map(product => {
        const quantity = Number(product.quantity || 0)
        const dailyRate = (sold.get(String(product.id)) || 0) / 30
        const target = Math.ceil(dailyRate * 7)
        return { ...product, dailyRate, buy: Math.max(0, target - quantity) }
      }).filter(product => product.buy > 0).sort((a, b) => b.buy - a.buy).slice(0, 4))
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading && !summary) return <LoadingSpinner size="lg" text={t('loading')} />

  const todaySales = summary?.today_sales ?? summary?.todaySales ?? 0
  const todayProfit = summary?.today_profit ?? summary?.todayProfit ?? 0
  const totalAlerts = alerts.lowStock.length + alerts.expiring.length + alerts.overdue.length

  return (
    <div className="px-4 pt-6 dark:bg-gray-900 min-h-screen">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tools')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('toolsSubtitle')}</p>
        </div>
        <button type="button" onClick={refresh} aria-label={t('refresh')} className="rounded-xl bg-white dark:bg-gray-800 p-3 text-primary shadow-sm">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <Card className="mb-4 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('todaySummary')}</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div><p className="text-xl font-bold text-gray-900 dark:text-white">Rs. {Number(todaySales).toLocaleString()}</p><p className="text-xs text-gray-500">{t('todaysSales')}</p></div>
          <div><p className="text-xl font-bold text-primary">Rs. {Number(todayProfit).toLocaleString()}</p><p className="text-xs text-gray-500">{t('todaysProfit')}</p></div>
        </div>
      </Card>

      <Card className="mb-6 dark:bg-gray-800 border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><ClipboardList size={22} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-gray-900 dark:text-white">{t('restockPlanner')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('restockPlannerSubtitle')}</p>
            {restock.length === 0 ? (
              <p className="text-sm text-primary mt-3">{t('stockLooksGood')}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {restock.map(product => (
                  <Link key={product.id} to={`/products/${product.id}`} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-700/60 px-3 py-2">
                    <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{product.name}</span>
                    <span className="ml-3 whitespace-nowrap text-sm font-bold text-primary">{t('buy')} {product.buy}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">{t('shopAlerts')} {totalAlerts > 0 && <span className="text-sm font-normal text-gray-500">({totalAlerts})</span>}</h2>
      <div className="space-y-3 mb-6">
        <Link to="/products" className="block"><Card variant={alerts.lowStock.length ? 'warning' : undefined} className="flex items-center gap-3 dark:bg-gray-800"><AlertTriangle className="text-orange-500" /><div><p className="font-semibold text-gray-800 dark:text-gray-200">{alerts.lowStock.length} {t('lowStock')}</p><p className="text-sm text-gray-500">{t('lowStockAction')}</p></div></Card></Link>
        <Link to="/products" className="block"><Card className="flex items-center gap-3 dark:bg-gray-800"><CalendarClock className="text-blue-500" /><div><p className="font-semibold text-gray-800 dark:text-gray-200">{alerts.expiring.length} {t('expiringSoon')}</p><p className="text-sm text-gray-500">{t('expiryAction')}</p></div></Card></Link>
        <Link to="/khata" className="block"><Card variant={alerts.overdue.length ? 'danger' : undefined} className="flex items-center gap-3 dark:bg-gray-800"><CreditCard className="text-red-500" /><div><p className="font-semibold text-gray-800 dark:text-gray-200">{alerts.overdue.length} {t('overdueCredits')}</p><p className="text-sm text-gray-500">{t('creditAction')}</p></div></Card></Link>
      </div>

      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">{t('quickActions')}</h2>
      <div className="grid grid-cols-2 gap-3 pb-6">
        <Link to="/sales/new"><Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800"><ShoppingCart className="text-primary" /><span className="font-semibold text-gray-800 dark:text-gray-200">{t('newSale')}</span></Card></Link>
        <Link to="/products/new"><Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800"><PackagePlus className="text-blue-500" /><span className="font-semibold text-gray-800 dark:text-gray-200">{t('addProduct')}</span></Card></Link>
        <Link to="/khata/new"><Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800"><UserPlus className="text-purple-500" /><span className="font-semibold text-gray-800 dark:text-gray-200">{t('addCustomer')}</span></Card></Link>
        <Link to="/sales/history"><Card className="flex flex-col items-center gap-2 py-5 dark:bg-gray-800"><Plus className="text-orange-500" /><span className="font-semibold text-gray-800 dark:text-gray-200">{t('viewSales')}</span></Card></Link>
      </div>
    </div>
  )
}
