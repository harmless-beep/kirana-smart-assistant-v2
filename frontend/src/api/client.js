import axios from 'axios'
import {
  localAuth, localRegister, localGetMe, localUserUpdate,
  localProducts, localProductGet, localProductCreate, localProductUpdate, localProductDelete, localLowStock,
  localSalesCreate, localSalesGetAll, localTodaySales,
  localCustomers, localCustomerCreate, localCustomerGet, localCustomerUpdate, localCustomerDelete, localCredits, localCreditAdd, localPaymentAdd,
  localDashboardSummary, localDashboardWeekly,
  localNotifications, localSettingsGet, localSettingsUpdate,
  localCategories, localCategoryCreate, localCategoryUpdate, localCategoryDelete,
} from './localDb'

const RAW_API_URL = import.meta.env.VITE_API_URL || ''
// Strip any trailing slash so we never build `//api`.
const API_URL = RAW_API_URL.replace(/\/+$/, '')
const client = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  // Render's free service can sleep. Keep the UI responsive while it wakes
  // up and let the existing localStorage fallback serve the first screen.
  timeout: 8000,
})

/**
 * Wake the free-tier API without blocking React startup. A successful health
 * check means the first real request is much less likely to hit a cold start;
 * a failure is intentionally ignored because every API operation has a local
 * fallback.
 */
export function warmBackend() {
  if (!API_URL || _backendAvailable === false) return
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  fetch(`${API_URL}/health`, { signal: controller.signal, cache: 'no-store' })
    .then(response => {
      if (response.ok) {
        _backendAvailable = true
        _lastTimeoutAt = 0
      }
    })
    .catch(() => {
      // Offline mode is a supported path; don't surface a warm-up failure.
    })
    .finally(() => clearTimeout(timer))
}

client.interceptors.request.use(config => {
  const token = localStorage.getItem('kirana-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kirana-token')
      // Keep the GitHub Pages project path intact. A root-relative redirect
      // sends visitors to the account homepage instead of this app.
      window.location.hash = '#/login'
    }
    return Promise.reject(err)
  }
)

let _backendAvailable = null
let _lastTimeoutAt = 0
const RETRY_COOLDOWN_MS = 60000
const DELETED_CUSTOMERS_KEY = 'kirana-deleted-customer-ids'

const asList = data => Array.isArray(data) ? data : (data?.items || [])

function deletedCustomerIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_CUSTOMERS_KEY) || '[]').map(Number))
  } catch {
    return new Set()
  }
}

function markCustomerDeleted(id) {
  const ids = deletedCustomerIds()
  ids.add(Number(id))
  localStorage.setItem(DELETED_CUSTOMERS_KEY, JSON.stringify([...ids]))
}

function clearDeletedCustomer(id) {
  const ids = deletedCustomerIds()
  ids.delete(Number(id))
  localStorage.setItem(DELETED_CUSTOMERS_KEY, JSON.stringify([...ids]))
}

function visibleCustomers(data) {
  const hidden = deletedCustomerIds()
  return asList(data).filter(customer => !hidden.has(Number(customer.id)))
}

function mergedProducts(remoteProducts, params) {
  const remote = asList(remoteProducts)
  const remoteIds = new Set(remote.map(product => String(product.id)))
  const localOnly = localProducts(params).filter(product => !remoteIds.has(String(product.id)))
  return [...remote, ...localOnly]
}

function mergedCategories(remoteCategories) {
  const remote = asList(remoteCategories)
  const names = new Set(remote.map(section => String(section.name || '').toLowerCase()))
  return [...localCategories().filter(section => !names.has(section.name.toLowerCase())), ...remote]
}

function resolveImageUrl(path) {
  if (!path || path.startsWith('data:') || /^https?:\/\//i.test(path)) return path
  return API_URL ? new URL(path, API_URL).href : path
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the selected image'))
    reader.readAsDataURL(file)
  })
}

async function uploadProductImage(file) {
  // When the backend is unreachable or the upload route is missing,
  // do NOT embed a multi-MB base64 data URL as image_path -- that
  // overflows the DB column and makes the whole product save fail
  // ("Failed to save product"). Instead signal "save without photo".
  const localResult = async () => ({
    data: { image_path: null, storageWarning: true },
  })
  if (!API_URL || _backendAvailable === false) return localResult()

  try {
    const formData = new FormData()
    formData.append('image', file)
    const response = await client.post('/products/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    _backendAvailable = true
    return response
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
    const isNetwork = err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED'
    // A cold Render free-tier start (30-50s) aborts the upload. Keep the
    // camera useful: signal "save without photo" and let the caller
    // queue a deferred upload once the backend is warm.
    const isColdStart = isTimeout || isNetwork
    if (isTimeout) _lastTimeoutAt = Date.now()
    if (isNetwork) _backendAvailable = false
    if (isColdStart) return localResult()
    throw err
  }
}

// --- Deferred image uploads (survive a cold Render start) ---
// A product can save instantly without its photo; the photo is then
// pushed in the background with backoff until the backend is reachable.
const _pendingUploads = []
let _flushing = false

export function queueDeferredUpload(productId, file) {
  if (!productId || !file) return
  _pendingUploads.push({ productId, file })
  flushDeferredUploads()
}

async function flushDeferredUploads(attempt = 1) {
  if (_flushing) return
  if (_pendingUploads.length === 0) return
  _flushing = true
  try {
    while (_pendingUploads.length > 0) {
      const { productId, file } = _pendingUploads[0]
      try {
        const formData = new FormData()
        formData.append('image', file)
        const res = await client.post('/products/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const path = res.data?.image_path
        if (path) {
          // Patch the product with the now-uploaded image path.
          await client.put(`/products/${productId}`, { image_path: path })
        }
        _pendingUploads.shift()
        _backendAvailable = true
        _lastTimeoutAt = 0
      } catch (err) {
        const retryable = err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' ||
          err.message?.includes('timeout') || (err.response?.status >= 500)
        if (!retryable) { _pendingUploads.shift(); continue }
        // Back off: 5s, 10s, 20s ... cap 30s, then loop.
        const wait = Math.min(30000, 5000 * 2 ** Math.min(attempt - 1, 3))
        await new Promise(r => setTimeout(r, wait))
        return flushDeferredUploads(attempt + 1)
      }
    }
  } finally {
    _flushing = false
  }
}

export function pendingUploadCount() {
  return _pendingUploads.length
}

function normalizeProduct(product) {
  if (!product) return product
  return {
    ...product,
    price: product.price ?? product.selling_price ?? 0,
    costPrice: product.costPrice ?? product.buying_price ?? 0,
    shelf: product.shelf ?? product.shelf_number ?? '',
    lowStockLimit: product.lowStockLimit ?? product.low_stock_limit ?? product.low_stock ?? 5,
    expiryDate: product.expiryDate ?? product.expiry_date ?? '',
    image: resolveImageUrl(product.image ?? product.image_path ?? ''),
    description: product.description ?? '',
  }
}

function toApiProduct(data) {
  return {
    name: data.name,
    category: data.category || null,
    brand: data.brand || null,
    buying_price: Number(data.costPrice ?? data.buying_price ?? 0),
    selling_price: Number(data.price ?? data.selling_price ?? 0),
    quantity: Number(data.quantity ?? 0),
    shelf_number: data.shelf ?? data.shelf_number ?? null,
    barcode: data.barcode || null,
    expiry_date: data.expiryDate || data.expiry_date || null,
    image_path: data.image || data.image_path || null,
    description: data.description || null,
    low_stock_limit: Number(data.lowStockLimit ?? data.low_stock_limit ?? 5),
  }
}

function normalizeTransaction(transaction) {
  if (!transaction) return transaction
  return {
    ...transaction,
    type: transaction.type ?? transaction.entry_type ?? 'credit',
    createdAt: transaction.createdAt ?? transaction.created_at ?? transaction.date,
  }
}

function normalizeSale(sale) {
  if (!sale) return sale
  return {
    ...sale,
    total: sale.total ?? sale.total_amount ?? 0,
    createdAt: sale.createdAt ?? sale.created_at,
  }
}

function normalizeDashboard(summary) {
  if (!summary) return summary
  return {
    ...summary,
    order_count: summary.order_count ?? summary.today_sale_count ?? 0,
    pending_credit: summary.pending_credit ?? summary.pending_credits ?? 0,
  }
}

function normalizeReport(report) {
  const sales = Array.isArray(report) ? report : (report?.items || report?.sales || [])
  const normalizedSales = sales.map((sale, index) => ({
    ...sale,
    name: sale.name ?? sale.product_name ?? `Sale #${index + 1}`,
    amount: sale.amount ?? sale.total ?? sale.total_amount ?? 0,
  }))
  const totalSales = report?.totalSales ?? report?.total_sales
    ?? normalizedSales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0)
  const totalProfit = report?.totalProfit ?? report?.total_profit
    ?? normalizedSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0)
  const totalOrders = report?.totalOrders ?? report?.sale_count ?? report?.item_count ?? normalizedSales.length
  return {
    ...report,
    totalSales,
    totalProfit,
    totalOrders,
    avgOrder: totalOrders ? totalSales / totalOrders : 0,
    sales: normalizedSales,
  }
}

function reportRange({ period, date }) {
  const selected = new Date(`${date}T00:00:00`)
  if (period === 'monthly') {
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1)
    const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
    return {
      start: first.toISOString().slice(0, 10),
      end: last.toISOString().slice(0, 10),
    }
  }
  if (period === 'weekly') {
    selected.setDate(selected.getDate() - 6)
    return { start: selected.toISOString().slice(0, 10), end: date }
  }
  return { start: date, end: date }
}

function normalizeNotification(notification) {
  return { ...notification, read: notification.read ?? notification.is_read ?? false }
}

async function adaptResponse(request, localFallback, transform = value => value) {
  const response = await tryBackend(request, localFallback)
  return { ...response, data: transform(response.data) }
}

async function tryBackend(fn, localFn) {
  // No API URL configured → localStorage only
  if (!API_URL && localFn) {
    _backendAvailable = false
    const result = localFn()
    return { data: result }
  }

  if (_backendAvailable === false && localFn) {
    const result = localFn()
    return { data: result }
  }

  if (_lastTimeoutAt && Date.now() - _lastTimeoutAt < RETRY_COOLDOWN_MS && localFn) {
    const result = localFn()
    return { data: result }
  }

  try {
    const res = await fn()
    _backendAvailable = true
    _lastTimeoutAt = 0
    return res
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
    const isNetwork = err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED'

    if (isTimeout) {
      _lastTimeoutAt = Date.now()
    }
    if (isNetwork) {
      _backendAvailable = false
    }

    if (localFn) {
      const result = localFn()
      return { data: result }
    }
    throw err
  }
}

export const api = {
  auth: {
    login: (data) => tryBackend(
      () => client.post('/auth/login', data),
      () => localAuth(data),
    ),
    register: (data) => tryBackend(
      () => client.post('/auth/register', data),
      () => localRegister(data),
    ),
    getMe: () => tryBackend(
      () => client.get('/auth/me'),
      () => localGetMe(),
    ),
    updateProfile: (data) => tryBackend(
      () => client.put('/auth/me', data),
      () => localUserUpdate(data),
    ),
  },
  products: {
    getAll: (params) => adaptResponse(
      () => client.get('/products', { params }),
      () => localProducts(params),
      products => mergedProducts(products, params).map(normalizeProduct),
    ),
    getById: (id) => adaptResponse(
      () => client.get(`/products/${id}`),
      () => localProductGet(id),
      normalizeProduct,
    ),
    create: (data) => adaptResponse(
      () => client.post('/products', toApiProduct(data)),
      () => localProductCreate(data),
      normalizeProduct,
    ),
    uploadImage: async (file) => {
      const response = await uploadProductImage(file)
      const path = response.data?.image_path
      return {
        ...response,
        data: {
          ...response.data,
          image: path ? resolveImageUrl(path) : '',
          // storageWarning tells the form to save the product
          // WITHOUT the photo when the upload could not complete.
          storageWarning: response.data?.storageWarning || false,
        },
      }
    },
    update: (id, data) => adaptResponse(
      () => client.put(`/products/${id}`, toApiProduct(data)),
      () => localProductUpdate(id, data),
      normalizeProduct,
    ),
    delete: (id) => tryBackend(
      () => client.delete(`/products/${id}`),
      () => localProductDelete(id),
    ),
    search: (q) => tryBackend(
      () => client.get('/products/search', { params: { q } }),
      () => localProducts({ search: q }),
    ),
    getLowStock: () => adaptResponse(
      () => client.get('/products/low-stock'),
      () => localLowStock(),
      products => asList(products).map(normalizeProduct),
    ),
    getExpiring: () => tryBackend(
      () => client.get('/products/expiring'),
      () => [],
    ),
  },
  categories: {
    getAll: () => adaptResponse(
      () => client.get('/categories'),
      () => localCategories(),
      mergedCategories,
    ),
    create: (data) => tryBackend(
      () => client.post('/categories', data),
      () => localCategoryCreate(data),
    ),
    update: (id, data) => tryBackend(
      () => client.put(`/categories/${id}`, data),
      () => localCategoryUpdate(id, data),
    ),
    delete: (id) => tryBackend(
      () => client.delete(`/categories/${id}`),
      () => localCategoryDelete(id),
    ),
  },
  sales: {
    getAll: (params) => adaptResponse(
      () => client.get('/sales', { params }),
      () => localSalesGetAll(params),
      sales => asList(sales).map(normalizeSale),
    ),
    create: (data) => adaptResponse(
      () => client.post('/sales', {
        customer_id: data.customerId || undefined,
        payment_method: data.paymentMethod || 'cash',
        items: data.items.map(item => ({
          product_id: item.productId ?? item.product_id,
          quantity: item.quantity,
          unit_price: Number(item.price ?? item.unit_price ?? 0),
        })),
      }),
      () => localSalesCreate(data),
      normalizeSale,
    ),
    getToday: () => tryBackend(
      () => client.get('/sales/today'),
      () => localTodaySales(),
    ),
    getWeekly: () => adaptResponse(
      () => client.get('/sales/weekly'),
      () => localDashboardWeekly(),
    ),
    getTopProducts: () => adaptResponse(
      () => client.get('/sales/top-products'),
      () => {
        const sales = localSalesGetAll()
        const products = localProducts()
        const counts = {}
        sales.forEach(s => (s.items || []).forEach(item => {
          const productId = item.product_id ?? item.productId
          counts[productId] = (counts[productId] || 0) + (item.quantity || 1)
        }))
        return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, qty]) => ({ product_name: products.find(p => p.id === id)?.name || 'Unknown', quantity: qty }))
      },
      products => asList(products).map(product => ({
        ...product,
        quantity: product.quantity ?? product.total_quantity ?? 0,
      })),
    ),
  },
  customers: {
    getAll: (params) => adaptResponse(
      () => client.get('/customers', { params }),
      () => localCustomers(),
      visibleCustomers,
    ),
    getById: (id) => adaptResponse(
      () => client.get(`/customers/${id}`),
      () => localCustomerGet(id),
    ),
    create: (data) => adaptResponse(
      () => client.post('/customers', data),
      () => localCustomerCreate(data),
    ),
    update: (id, data) => adaptResponse(
      () => client.put(`/customers/${id}`, data),
      () => localCustomerUpdate(id, data),
    ),
    delete: async (id) => {
      try {
        const response = await client.delete(`/customers/${id}`)
        clearDeletedCustomer(id)
        return response
      } catch (err) {
        const status = err.response?.status
        if (status && status !== 404 && status !== 405 && status < 500) throw err
        markCustomerDeleted(id)
        return { data: localCustomerDelete(id) }
      }
    },
    getCredits: (id) => adaptResponse(
      () => client.get(`/customers/${id}/credits`),
      () => localCredits(id),
      credits => asList(credits).map(normalizeTransaction),
    ),
    addCredit: (id, data) => adaptResponse(
      () => client.post(`/customers/${id}/credits`, { amount: data.amount, notes: data.notes, entry_type: 'credit' }),
      () => localCreditAdd(id, data),
      normalizeTransaction,
    ),
    addPayment: (id, data) => adaptResponse(
      () => client.post(`/customers/${id}/payments`, { amount: data.amount, notes: data.notes }),
      () => localPaymentAdd(id, data),
      normalizeTransaction,
    ),
    getOverdue: () => tryBackend(
      () => client.get('/customers/overdue'),
      () => [],
    ),
  },
  dashboard: {
    getSummary: () => adaptResponse(
      () => client.get('/dashboard'),
      () => localDashboardSummary(),
      normalizeDashboard,
    ),
    getWeekly: () => adaptResponse(
      () => client.get('/dashboard/weekly'),
      () => localDashboardWeekly(),
      weekly => Array.isArray(weekly)
        ? weekly
        : (weekly?.daily || []).map(day => ({
          ...day,
          sales: day.sales ?? day.total_sales ?? 0,
        })),
    ),
  },
  reports: {
    getDaily: (date) => adaptResponse(
      () => client.get('/reports/daily', { params: { date } }),
      () => localSalesGetAll({ start_date: date, end_date: date }),
      normalizeReport,
    ),
    getWeekly: (start, end) => adaptResponse(
      () => client.get('/reports/weekly', { params: { start, end } }),
      () => localSalesGetAll({ start_date: start, end_date: end }),
      normalizeReport,
    ),
    getMonthly: (date) => adaptResponse(
      () => {
        const selected = new Date(`${date}T00:00:00`)
        return client.get('/reports/monthly', { params: { month: selected.getMonth() + 1, year: selected.getFullYear() } })
      },
      () => localSalesGetAll({ start_date: `${date}-01`, end_date: `${date}-31` }),
      normalizeReport,
    ),
    exportExcel: (options) => tryBackend(() => client.get('/reports/export/excel', { params: reportRange(options), responseType: 'blob' }), null),
    exportPdf: (options) => tryBackend(() => client.get('/reports/export/pdf', { params: reportRange(options), responseType: 'blob' }), null),
  },
  notifications: {
    getAll: () => adaptResponse(
      () => client.get('/notifications'),
      () => localNotifications(),
      notifications => asList(notifications).map(normalizeNotification),
    ),
    markRead: (id) => adaptResponse(
      () => client.put(`/notifications/${id}/read`),
      () => {},
      normalizeNotification,
    ),
    check: () => tryBackend(
      () => client.post('/notifications/check'),
      () => localNotifications(),
    ),
  },
  settings: {
    getAll: () => tryBackend(
      () => client.get('/settings'),
      () => localSettingsGet(),
    ),
    update: (data) => tryBackend(
      () => client.put('/settings', Object.entries(data).map(([key, value]) => ({ key, value: String(value ?? '') }))),
      () => localSettingsUpdate(data),
    ),
  },
  barcode: {
    generate: (productId) => tryBackend(
      () => client.get(`/barcode/${productId}`, { responseType: 'blob' }),
      null,
    ),
    scan: (barcode) => tryBackend(
      () => client.post('/barcode/scan', { barcode_value: barcode }),
      null,
    ),
  },
  queueDeferredUpload,
}

export default client
