import { useState, useEffect, useCallback } from 'react'
import { FileText, FileSpreadsheet, Calendar } from 'lucide-react'
import { api } from '../api/client'
import Card from '../components/Card'
import StatCard from '../components/StatCard'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import { useLanguage } from '../context/LanguageContext'

const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]))

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export default function Reports() {
  const { t } = useLanguage()
  const [period, setPeriod] = useState('daily')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)
  const [exportMessage, setExportMessage] = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      let res
      if (period === 'daily') {
        res = await api.reports.getDaily(date)
      } else if (period === 'weekly') {
        const end = date
        const start = new Date(new Date(date).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        res = await api.reports.getWeekly(start, end)
      } else {
        res = await api.reports.getMonthly(date.slice(0, 7))
      }
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [period, date])

  useEffect(() => { loadReport() }, [loadReport])

  async function handleExport(type) {
    setExporting(type)
    setExportMessage('')
    try {
      let res
      if (type === 'excel') {
        res = await api.reports.exportExcel({ period, date })
      } else {
        res = await api.reports.exportPdf({ period, date })
      }
      downloadBlob(new Blob([res.data]), `report-${period}-${date}.${type === 'excel' ? 'xlsx' : 'pdf'}`)
    } catch {
      if (!data) {
        setExportMessage(t('reportExportFailed'))
      } else if (type === 'excel') {
        const rows = [
          ['Date', 'Sale', 'Amount', 'Profit'],
          ...data.sales.map((sale, index) => [
            sale.date || sale.createdAt || sale.created_at || '',
            sale.name || `Sale #${index + 1}`,
            sale.amount ?? sale.total ?? 0,
            sale.profit ?? 0,
          ]),
          ['', 'Total', data.totalSales || 0, data.totalProfit || 0],
        ]
        downloadBlob(new Blob([`\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' }), `report-${period}-${date}.csv`)
        setExportMessage(t('reportExportFallback'))
      } else {
        const popup = window.open('', '_blank', 'width=720,height=800')
        if (!popup) {
          setExportMessage(t('printBlocked'))
        } else {
          const rows = data.sales.map((sale, index) => `<tr><td>${escapeHtml(sale.date || sale.createdAt || sale.created_at || '')}</td><td>${escapeHtml(sale.name || `Sale #${index + 1}`)}</td><td>Rs. ${Number(sale.amount ?? sale.total ?? 0).toLocaleString()}</td></tr>`).join('')
          popup.document.write(`<!doctype html><html><head><title>${t('reports')}</title><style>body{font-family:Arial,sans-serif;padding:28px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:9px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>${t('reports')}</h1><p>${date}</p><p><strong>${t('totalSales')}:</strong> Rs. ${Number(data.totalSales || 0).toLocaleString()}</p><table><thead><tr><th>${t('date')}</th><th>${t('sale')}</th><th>${t('amount')}</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`)
          popup.document.close()
          setExportMessage(t('reportExportFallback'))
        }
      }
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8">
      <PageHeader icon={FileText} title={t('reports')} />

      {/* Period Selector */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-4 dark:bg-gray-800">
        {['daily', 'weekly', 'monthly'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors capitalize ${
              period === p ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t(p)}
          </button>
        ))}
      </div>

      {/* Date Selector */}
      <div className="mb-5">
        <label className="block text-base font-medium text-gray-700 mb-1 flex items-center gap-1 dark:text-gray-300">
          <Calendar size={16} /> {t('selectDate')}
        </label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full h-14 px-4 text-lg bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
      </div>

      {loading ? (
        <LoadingSpinner text={t('loadingReport')} />
      ) : !data ? (
        <Card className="text-center py-8">
          <p className="text-gray-500 text-lg">{t('noDataAvailable')}</p>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5">
            <StatCard title={t('totalSales')} value={`Rs. ${(data.totalSales || 0).toLocaleString()}`} color="green" />
            <StatCard title={t('totalProfit')} value={`Rs. ${(data.totalProfit || 0).toLocaleString()}`} color="blue" />
            <StatCard title={t('orders')} value={data.totalOrders || 0} color="purple" />
            <StatCard title={t('averageOrder')} value={`Rs. ${(data.avgOrder || 0).toLocaleString()}`} color="orange" />
          </div>

          {/* Sales Breakdown */}
          {data.sales && data.sales.length > 0 && (
            <Card className="mb-5">
              <h3 className="text-lg font-bold text-gray-800 mb-3">{t('salesBreakdown')}</h3>
              <div className="flex flex-col gap-2">
                {data.sales.map((sale, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-base text-gray-800">{sale.name || `Sale #${idx + 1}`}</p>
                      <p className="text-sm text-gray-500">{sale.date || sale.time || ''}</p>
                    </div>
                    <p className="text-base font-bold text-gray-900">Rs. {(sale.amount || sale.total || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Export Buttons */}
          <div className="flex gap-3 mb-4">
            <Button
              variant="primary"
              fullWidth
              icon={FileSpreadsheet}
              loading={exporting === 'excel'}
              onClick={() => handleExport('excel')}
            >
              {t('downloadExcel')}
            </Button>
            <Button
              variant="danger"
              fullWidth
              icon={FileText}
              loading={exporting === 'pdf'}
              onClick={() => handleExport('pdf')}
            >
              {t('downloadPDF')}
            </Button>
          </div>
          {exportMessage && <p className="text-sm text-gray-600 text-center">{exportMessage}</p>}
        </>
      )}
    </div>
  )
}
