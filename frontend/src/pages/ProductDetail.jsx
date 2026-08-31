import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Edit, Trash2, Package, Printer, Calendar, MapPin, Plus, Minus } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import PageHeader from '../components/PageHeader'

const CATEGORY_KEYS = {
  Grocery: 'grocery', Snacks: 'snacks', Drinks: 'drinks', Dairy: 'dairy',
  'Personal Care': 'personalCare', Household: 'household', Others: 'others',
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [stockChange, setStockChange] = useState('')
  const [adjustingStock, setAdjustingStock] = useState(false)
  const [error, setError] = useState('')

  const loadProduct = useCallback(async () => {
    try {
      const res = await api.products.getById(id)
      setProduct(res.data?.product || res.data)
    } catch {
      navigate('/products')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { loadProduct() }, [loadProduct])

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await api.products.delete(id)
      navigate('/products')
    } catch (err) {
      setError(err.response?.data?.detail || t('error'))
      setDeleting(false)
    }
  }

  function handlePrintBarcode() {
    const popup = window.open('', '_blank', 'width=420,height=300')
    if (!popup) return

    const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]))
    const productName = escapeHtml(product.name)
    const barcode = escapeHtml(product.barcode || `SKU-${product.id}`)
    popup.document.write(`<!doctype html><html><head><title>${t('printBarcode')}</title><style>
      body{font-family:Arial,sans-serif;padding:24px}.label{border:2px solid #111;padding:18px;text-align:center;max-width:320px;margin:auto}
      .code{font-family:monospace;font-size:28px;letter-spacing:4px;margin:16px 0 8px}.price{font-size:20px;font-weight:bold}
    </style></head><body><div class="label"><strong>${productName}</strong><div class="code">||| ${barcode} |||</div><div class="price">Rs. ${Number(product.price || 0).toLocaleString()}</div></div><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`)
    popup.document.close()
  }

  async function adjustStock(direction) {
    const amount = Math.floor(Number(stockChange))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('validStockChange'))
      return
    }

    const nextQuantity = Math.max(0, qty + (direction * amount))
    setAdjustingStock(true)
    setError('')
    try {
      const response = await api.products.update(id, { ...product, quantity: nextQuantity })
      setProduct(response.data?.product || response.data)
      setStockChange('')
    } catch (err) {
      setError(err.response?.data?.detail || t('stockUpdateFailed'))
    } finally {
      setAdjustingStock(false)
    }
  }

  if (loading) return <LoadingSpinner text={t('loadingProduct')} />
  if (!product) return null

  const qty = product.quantity ?? product.stock ?? 0
  const lowStock = product.lowStockLimit ?? 5

  function stockStatus() {
    if (qty <= 0) return { label: t('outOfStock'), color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' }
    if (qty <= lowStock) return { label: t('lowStock'), color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' }
    return { label: t('inStock'), color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' }
  }

  const status = stockStatus()

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 dark:bg-gray-900 min-h-screen">
      <PageHeader
        icon={Package}
        title={t('productDetails')}
        onBack={() => navigate(-1)}
        action={
          <Link to={`/products/${id}/edit`} aria-label={t('editProduct')}>
            <button type="button" className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center active:bg-white/30 transition-colors">
              <Edit size={18} />
            </button>
          </Link>
        }
      />

      {/* Product Image */}
      <div className="w-full h-52 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4 flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package size={56} className="text-gray-300 dark:text-gray-600" />
        )}
      </div>

      {/* Product Info */}
      <Card className="mb-4 dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h2>
        {product.barcode && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{product.barcode}</p>
        )}
        <div className="flex items-center gap-3 mt-3">
          <p className="text-3xl font-bold text-primary">Rs. {Number(product.price ?? 0).toLocaleString()}</p>
          {product.costPrice && (
            <p className="text-base text-gray-400">{t('buyingPrice')}: Rs. {product.costPrice.toLocaleString()}</p>
          )}
        </div>
      </Card>

      {/* Status & Stock */}
      <Card className="mb-4 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base text-gray-600 dark:text-gray-400">{t('stockStatus')}</span>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${status.color}`}>{status.label}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-base text-gray-600 dark:text-gray-400">{t('quantity')}</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{qty} {t('units')}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-base text-gray-600 dark:text-gray-400">{t('lowStockAlert')}</span>
          <span className="text-base text-gray-700 dark:text-gray-300">{t('below', { count: lowStock })}</span>
        </div>
        {product.shelf && (
          <div className="flex items-center justify-between">
            <span className="text-base text-gray-600 dark:text-gray-400 flex items-center gap-1"><MapPin size={16} /> {t('shelfNumber')}</span>
            <span className="text-base text-gray-700 dark:text-gray-300">{product.shelf}</span>
          </div>
        )}
        <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3">
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">{t('quickStockUpdate')}</label>
          <div className="flex gap-2 items-stretch">
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={stockChange}
              onChange={event => setStockChange(event.target.value)}
              placeholder={t('quantity')}
              className="min-w-0 flex-1 h-12 px-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white text-base text-center"
            />
            <button
              type="button"
              onClick={() => adjustStock(1)}
              disabled={adjustingStock}
              className="h-12 px-3 sm:px-4 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-semibold text-sm flex items-center gap-1.5 active:bg-green-200 dark:active:bg-green-900/60 disabled:opacity-50 transition-colors"
            >
              <Plus size={18} /> <span className="hidden sm:inline">{t('restock')}</span>
            </button>
            <button
              type="button"
              onClick={() => adjustStock(-1)}
              disabled={adjustingStock}
              className="h-12 px-3 sm:px-4 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold text-sm flex items-center gap-1.5 active:bg-red-200 dark:active:bg-red-900/60 disabled:opacity-50 transition-colors"
            >
              <Minus size={18} /> <span className="hidden sm:inline">{t('removeStock')}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Extra Details */}
      <Card className="mb-4 dark:bg-gray-800">
        {product.category && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-base text-gray-600 dark:text-gray-400">{t('category')}</span>
            <span className="text-base text-gray-700 dark:text-gray-300">{CATEGORY_KEYS[product.category] ? t(CATEGORY_KEYS[product.category]) : product.category}</span>
          </div>
        )}
        {product.expiryDate && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-base text-gray-600 dark:text-gray-400 flex items-center gap-1"><Calendar size={16} /> {t('expiryDate')}</span>
            <span className="text-base text-gray-700 dark:text-gray-300">{new Date(product.expiryDate).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US')}</span>
          </div>
        )}
        {product.description && (
          <div>
            <span className="text-base text-gray-600 dark:text-gray-400 block mb-1">{t('description')}</span>
            <p className="text-base text-gray-700 dark:text-gray-300">{product.description}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Link to={`/products/${id}/edit`} className="flex-1">
          <Button variant="primary" fullWidth icon={Edit}>{t('editProduct')}</Button>
        </Link>
        <Button variant="ghost" icon={Printer} onClick={handlePrintBarcode}>
          {t('print')}
        </Button>
      </div>

      <div className="mb-8">
        <Button variant="danger" fullWidth icon={Trash2} onClick={() => setShowDelete(true)}>
          {t('deleteProduct')}
        </Button>
      </div>

      {error && <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl p-3 text-red-600 dark:text-red-400">{error}</div>}

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t('deleteProduct')}
        message={t('deleteProductMessage', { name: product.name })}
        confirmText={deleting ? `${t('delete')}...` : t('delete')}
        danger
      />
    </div>
  )
}
