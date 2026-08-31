import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, ReceiptText, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

const entityId = item => item.id ?? item._id

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]))
}

export default function SalesHistory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSales = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.sales.getAll({ limit: 100 })
      setSales(response.data?.sales || response.data || [])
    } catch {
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSales() }, [loadSales])

  function printSale(sale) {
    const popup = window.open('', '_blank', 'width=420,height=640')
    if (!popup) return
    const rows = (sale.items || []).map((item, index) => {
      const quantity = Number(item.quantity || 0)
      const price = Number(item.unit_price ?? item.price ?? 0)
      const name = item.product_name || item.name || `${t('item')} ${index + 1}`
      return `<tr><td>${escapeHtml(name)} x${quantity}</td><td>Rs. ${(price * quantity).toLocaleString()}</td></tr>`
    }).join('')
    const total = Number(sale.total ?? sale.total_amount ?? 0)
    const date = sale.createdAt || sale.created_at
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(t('receipt'))}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}.receipt{max-width:360px;margin:auto}.head{text-align:center;border-bottom:1px dashed #888;padding-bottom:12px}.rows{width:100%;border-collapse:collapse;margin:16px 0}.rows td{padding:7px 0;border-bottom:1px solid #eee}.rows td:last-child{text-align:right}.total{font-size:20px;font-weight:700;display:flex;justify-content:space-between;border-top:2px solid #111;padding-top:10px}.meta{color:#555;font-size:13px;line-height:1.6}
    </style></head><body><main class="receipt"><header class="head"><h2>${escapeHtml(user?.shop_name || user?.shopName || t('shopName'))}</h2><p>${escapeHtml(t('receipt'))}</p></header><p class="meta">${date ? escapeHtml(new Date(date).toLocaleString(lang === 'ne' ? 'ne-NP' : 'en-US')) : ''}<br>${escapeHtml(t('paymentMethod'))}: ${escapeHtml(t(sale.paymentMethod || sale.payment_method || 'cash'))}</p><table class="rows">${rows}</table><div class="total"><span>${escapeHtml(t('total'))}</span><span>Rs. ${total.toLocaleString()}</span></div><p class="meta" style="text-align:center;margin-top:24px">${escapeHtml(t('thankYou'))}</p></main><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`)
    popup.document.close()
  }

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8">
      <PageHeader
        icon={ReceiptText}
        title={t('saleHistory')}
        onBack={() => navigate(-1)}
        action={<Button variant="white" icon={RefreshCw} onClick={loadSales}>{t('refresh')}</Button>}
      />

      {loading ? <LoadingSpinner text={t('loading')} /> : sales.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t('noSaleHistory')} description={t('startFirstSale')} />
      ) : (
        <div className="flex flex-col gap-3">
          {sales.map(sale => {
            const total = Number(sale.total ?? sale.total_amount ?? 0)
            const createdAt = sale.createdAt || sale.created_at
            const method = sale.paymentMethod || sale.payment_method || 'cash'
            return (
              <Card key={entityId(sale)} className="dark:bg-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{createdAt ? new Date(createdAt).toLocaleString(lang === 'ne' ? 'ne-NP' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : t('sale')}</p>
                    <p className="text-sm text-gray-500 mt-1">{sale.items?.length || 0} {t('items')} | {t(method)}</p>
                  </div>
                  <p className="font-bold text-lg text-primary">Rs. {total.toLocaleString()}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end"><Button variant="ghost" icon={Printer} onClick={() => printSale(sale)}>{t('printReceipt')}</Button></div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
