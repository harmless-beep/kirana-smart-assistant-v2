import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Minus, Trash2, Check, ShoppingCart, Printer, Home, Banknote, Smartphone } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import Card from '../components/Card'
import PageHeader from '../components/PageHeader'

const entityId = item => item.id ?? item._id
const stockOf = item => Math.max(0, Number(item.quantity ?? item.stock ?? 0))

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]))
}

export default function NewSale() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [error, setError] = useState('')
  const [paymentQr, setPaymentQr] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [productResult, customerResult] = await Promise.allSettled([
      api.products.getAll(),
      api.customers.getAll(),
    ])
    if (productResult.status === 'fulfilled') setProducts(productResult.value.data?.products || productResult.value.data || [])
    if (customerResult.status === 'fulfilled') setCustomers(customerResult.value.data?.customers || customerResult.value.data || [])
    // Shop payment QR (stored in settings) so it can be shown after a sale.
    api.settings.getAll().then(res => {
      const list = res.data || []
      const found = list.find(setting => setting.key === 'payment_qr')
      if (found?.value) setPaymentQr(found.value)
    }).catch(() => {})
  }

  const filtered = products.filter(product => {
    const query = search.trim().toLowerCase()
    return !query || product.name?.toLowerCase().includes(query) || product.barcode?.toLowerCase().includes(query)
  })

  function addToCart(product) {
    const productId = entityId(product)
    const available = stockOf(product)
    if (available === 0) {
      setError(t('productOutOfStock', { name: product.name }))
      return
    }

    setCart(previous => {
      const existing = previous.find(item => entityId(item) === productId)
      if (existing?.qty >= available) {
        setError(t('maxStockReached', { count: available }))
        return previous
      }
      if (existing) {
        return previous.map(item => entityId(item) === productId ? { ...item, qty: item.qty + 1 } : item)
      }
      return [...previous, { ...product, qty: 1 }]
    })
    setError('')
    setSearch('')
  }

  function updateQty(productId, delta) {
    setCart(previous => previous
      .map(item => {
        if (entityId(item) !== productId) return item
        const next = Math.max(0, Math.min(stockOf(item), item.qty + delta))
        if (delta > 0 && next === item.qty) setError(t('maxStockReached', { count: stockOf(item) }))
        return { ...item, qty: next }
      })
      .filter(item => item.qty > 0))
  }

  function removeFromCart(productId) {
    setCart(previous => previous.filter(item => entityId(item) !== productId))
  }

  function addBarcodeMatch(event) {
    if (event.key !== 'Enter' || !search.trim()) return
    event.preventDefault()
    const barcodeMatch = products.find(product => product.barcode?.toLowerCase() === search.trim().toLowerCase())
    if (barcodeMatch) addToCart(barcodeMatch)
  }

  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.qty, 0)
  const costTotal = cart.reduce((sum, item) => sum + Number(item.costPrice ?? item.price ?? 0) * item.qty, 0)
  const profit = total - costTotal

  async function completeSale() {
    if (cart.length === 0) return
    if (paymentMethod === 'credit' && !selectedCustomer) {
      setError(t('selectCustomerForCredit'))
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await api.sales.create({
        items: cart.map(item => ({ productId: entityId(item), name: item.name, price: item.price, quantity: item.qty })),
        total,
        profit,
        paymentMethod,
        customerId: selectedCustomer || undefined,
      })
      setCompletedSale(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || t('saleSaveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  function printReceipt() {
    const popup = window.open('', '_blank', 'width=420,height=640')
    if (!popup) {
      setError(t('printBlocked'))
      return
    }
    const customer = customers.find(item => String(entityId(item)) === String(selectedCustomer))
    const rows = cart.map(item => `<tr><td>${escapeHtml(item.name)} x${item.qty}</td><td>Rs. ${(Number(item.price || 0) * item.qty).toLocaleString()}</td></tr>`).join('')
    const shopName = escapeHtml(user?.shop_name || user?.shopName || t('shopName'))
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(t('receipt'))}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}.receipt{max-width:360px;margin:auto}.head{text-align:center;border-bottom:1px dashed #888;padding-bottom:12px}.rows{width:100%;border-collapse:collapse;margin:16px 0}.rows td{padding:7px 0;border-bottom:1px solid #eee}.rows td:last-child{text-align:right}.total{font-size:20px;font-weight:700;display:flex;justify-content:space-between;border-top:2px solid #111;padding-top:10px}.meta{color:#555;font-size:13px;line-height:1.6}
    </style></head><body><main class="receipt"><header class="head"><h2>${shopName}</h2><p>${escapeHtml(t('receipt'))}</p></header><p class="meta">${new Date().toLocaleString()}<br>${escapeHtml(t('paymentMethod'))}: ${escapeHtml(t(paymentMethod))}${customer ? `<br>${escapeHtml(t('customer'))}: ${escapeHtml(customer.name)}` : ''}</p><table class="rows">${rows}</table><div class="total"><span>${escapeHtml(t('total'))}</span><span>Rs. ${total.toLocaleString()}</span></div><p class="meta" style="text-align:center;margin-top:24px">${escapeHtml(t('thankYou'))}</p></main><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`)
    popup.document.close()
  }

  function startNewSale() {
    setCart([])
    setSearch('')
    setSelectedCustomer(null)
    setPaymentMethod('cash')
    setCompletedSale(null)
  }

  if (completedSale) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4 animate-bounce">
          <Check size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('saleComplete')}</h2>
        <p className="text-lg text-gray-500 mb-4">Rs. {total.toLocaleString()} {t('recorded')}</p>
        {paymentQr && (
          <div className="w-full max-w-sm mb-5">
            <div className="rounded-2xl bg-white p-4 shadow-soft mb-2">
              <img src={paymentQr} alt="Payment QR" className="w-48 h-48 mx-auto object-contain" />
            </div>
            <p className="text-base font-semibold text-gray-700">
              {lang === 'ne' ? 'स्क्यान गरेर भुक्तानी गर्नुहोस्' : 'Scan to pay'} Rs. {total.toLocaleString()}
            </p>
          </div>
        )}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <Button fullWidth icon={Printer} onClick={printReceipt}>{t('printReceipt')}</Button>
          <Button fullWidth variant="secondary" icon={Plus} onClick={startNewSale}>{t('startNewSale')}</Button>
          <Button fullWidth variant="ghost" icon={Home} onClick={() => navigate('/')}>{t('backHome')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8 dark:bg-gray-900 min-h-screen">
      <PageHeader icon={ShoppingCart} title={t('newSale')} onBack={() => navigate(-1)} />

      <div className="relative mb-3 sm:mb-4">
        <Search size={20} className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={event => setSearch(event.target.value)}
          onKeyDown={addBarcodeMatch}
          placeholder={t('searchProductsToAdd')}
          className="w-full h-12 sm:h-14 pl-10 sm:pl-11 pr-3 sm:pr-4 text-base sm:text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white"
        />
      </div>

      {search && (
        <Card className="mb-4 max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-base text-gray-500 dark:text-gray-400 text-center py-4">{t('noProductsFound')}</p>
          ) : filtered.slice(0, 8).map(product => {
            const available = stockOf(product)
            return (
              <button
                key={entityId(product)}
                type="button"
                onClick={() => addToCart(product)}
                disabled={available === 0}
                className="w-full flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 active:bg-gray-50 dark:active:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-left">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-base">{product.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Rs. {Number(product.price || 0).toLocaleString()} | {available === 0 ? t('outOfStock') : `${available} ${t('inStock')}`}</p>
                </div>
                <Plus size={22} className="text-primary" />
              </button>
            )
          })}
        </Card>
      )}

      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
        <ShoppingCart size={20} /> {t('cart')} ({cart.length} {t('items')})
      </h3>
      {cart.length === 0 ? (
        <Card className="text-center py-8 mb-4">
          <ShoppingCart size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-base">{t('searchAndAddProducts')}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {cart.map(item => (
            <Card key={entityId(item)} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-base truncate">{item.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Rs. {Number(item.price || 0).toLocaleString()} {t('each')} | {stockOf(item)} {t('available')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => updateQty(entityId(item), -1)} aria-label={t('decreaseQuantity')} className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center active:bg-gray-200 dark:active:bg-gray-600"><Minus size={18} className="text-gray-600 dark:text-gray-300" /></button>
                <span className="w-8 text-center text-lg font-bold">{item.qty}</span>
                <button type="button" onClick={() => updateQty(entityId(item), 1)} disabled={item.qty >= stockOf(item)} aria-label={t('increaseQuantity')} className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center active:bg-primary-dark disabled:opacity-40"><Plus size={18} className="text-white" /></button>
                <button type="button" onClick={() => removeFromCart(entityId(item))} aria-label={t('delete')} className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center ml-1 active:bg-red-100 dark:active:bg-red-900/50"><Trash2 size={16} className="text-red-500 dark:text-red-400" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {customers.length > 0 && (
        <div className="mb-4">
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('customerOptional')}</label>
          <select value={selectedCustomer || ''} onChange={event => setSelectedCustomer(event.target.value || null)} className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white">
            <option value="">{t('cashCustomer')}</option>
            {customers.map(customer => <option key={entityId(customer)} value={entityId(customer)}>{customer.name}</option>)}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">{t('paymentMethod')}</label>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {[
            { id: 'cash', label: 'cash', icon: Banknote },
            { id: 'credit', label: 'credit', icon: ShoppingCart },
            { id: 'esewa', label: 'esewa', icon: Smartphone },
            { id: 'khalti', label: 'khalti', icon: Smartphone },
          ].map(method => {
            const Icon = method.icon
            return <button key={method.id} type="button" onClick={() => setPaymentMethod(method.id)} className={`flex flex-col items-center gap-0.5 sm:gap-1 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-colors ${paymentMethod === method.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-700'}`}><Icon size={18} />{t(method.label)}</button>
          })}
        </div>
      </div>

      {cart.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-2"><span className="text-base text-gray-600 dark:text-gray-400">{t('subtotal')}</span><span className="text-lg font-bold text-gray-900 dark:text-white">Rs. {total.toLocaleString()}</span></div>
          <div className="flex items-center justify-between mb-2"><span className="text-base text-gray-600 dark:text-gray-400">{t('profit')}</span><span className="text-lg font-bold text-green-600 dark:text-green-400">Rs. {profit.toLocaleString()}</span></div>
          <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2 flex items-center justify-between"><span className="text-xl font-bold text-gray-900 dark:text-white">{t('total')}</span><span className="text-2xl font-bold text-primary">Rs. {total.toLocaleString()}</span></div>
        </Card>
      )}

      {error && <div className="mb-4 rounded-xl border border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-red-600 dark:text-red-400">{error}</div>}

      <Button fullWidth size="lg" variant="primary" disabled={cart.length === 0} loading={submitting} onClick={completeSale} icon={Check}>
        {t('completeSale')} - Rs. {total.toLocaleString()}
      </Button>
    </div>
  )
}
