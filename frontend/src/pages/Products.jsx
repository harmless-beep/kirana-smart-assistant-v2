import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Package, SlidersHorizontal } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { usePolling } from '../hooks/usePolling'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { hapticImpact } from '../utils/haptics'
import { api } from '../api/client'
import SearchBar from '../components/SearchBar'
import Card from '../components/Card'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import SectionManager from '../components/SectionManager'
import PageHeader from '../components/PageHeader'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'

export default function Products() {
  const { t } = useLanguage()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState([])
  const [showSections, setShowSections] = useState(false)

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = category !== 'All' ? { category } : {}
      const res = await api.products.getAll(params)
      setProducts(res.data?.products || res.data || [])
    } catch {
      setProducts([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [category])

  useEffect(() => { loadProducts() }, [loadProducts])

  // Refresh quietly so prices/stock changed on another device appear here
  // without a manual reload.
  usePolling(() => loadProducts(true), 30000)

  const loadSections = useCallback(async () => {
    try {
      const response = await api.categories.getAll()
      const next = response.data?.categories || response.data || []
      setSections(next)
      if (category !== 'All' && !next.some(section => section.name === category)) setCategory('All')
    } catch {
      setSections([])
    }
  }, [category])

  useEffect(() => { loadSections() }, [loadSections])

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
    return matchSearch
  })

  function getStockBadge(qty, lowStockLimit) {
    if (qty <= 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('outOfStock')}</span>
    if (qty <= (lowStockLimit || 5)) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{t('low')}: {qty}</span>
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{qty} {t('inStock')}</span>
  }

  const handleRefresh = useCallback(async () => {
    hapticImpact()
    await Promise.all([loadProducts(true), loadSections()])
  }, [loadProducts, loadSections])

  const { containerProps, refreshing, showIndicator, pullDistance } = usePullToRefresh(handleRefresh)

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 dark:bg-gray-900 min-h-screen" {...containerProps}>
      <PullToRefreshIndicator refreshing={refreshing} pullDistance={pullDistance} />
      <PageHeader
        icon={Package}
        title={t('products')}
        subtitle={`${products.length} ${t('items')}`}
        action={
          <>
            <button type="button" onClick={() => setShowSections(true)} aria-label={t('manageSections')} className="w-11 h-11 rounded-xl bg-white/20 text-white flex items-center justify-center active:bg-white/30 transition-colors"><SlidersHorizontal size={19} /></button>
            <Link to="/products/new"><Button variant="white" icon={Plus} size="md">{t('add')}</Button></Link>
          </>
        }
      />

      <SearchBar value={search} onChange={setSearch} placeholder={t('searchProducts')} />

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
        {[{ id: 'all', name: 'All', key: 'all' }, ...sections].map(section => (
          <button
            key={section.id}
            type="button"
            onClick={() => setCategory(section.name)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              category === section.name
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {section.key ? t(section.key) : section.name}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner text={t('loading')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('noProducts')}
          description={t('addFirstProduct')}
          action={
            <Link to="/products/new">
              <Button>{t('addProduct')}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {filtered.map(product => (
            <Link key={product.id} to={`/products/${product.id}`}>
              <Card className="dark:bg-gray-800">
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-xl mb-2 sm:mb-3 flex items-center justify-center overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={28} className="text-gray-300 dark:text-gray-600" />
                  )}
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-xs sm:text-sm mb-1 line-clamp-2">{product.name}</h3>
                <p className="text-primary font-bold text-sm sm:text-base">Rs. {Number(product.price ?? 0).toLocaleString()}</p>
                <div className="flex items-center justify-between mt-2">
                  {getStockBadge(product.quantity, product.lowStockLimit)}
                  {product.shelf && (
                    <span className="text-xs text-gray-400">{product.shelf}</span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <SectionManager isOpen={showSections} onClose={() => setShowSections(false)} onChanged={loadSections} />
    </div>
  )
}
