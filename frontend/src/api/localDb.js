const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const DEFAULT_SECTIONS = [
  ['Grocery', 'grocery'], ['Snacks', 'snacks'], ['Drinks', 'drinks'], ['Dairy', 'dairy'],
  ['Personal Care', 'personalCare'], ['Household', 'household'], ['Others', 'others'],
  ['Uncategorized', 'uncategorized'],
]

function getStore(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(`kirana_${key}`)) || fallback }
  catch { return fallback }
}
function setStore(key, val) { localStorage.setItem(`kirana_${key}`, JSON.stringify(val)) }

function withoutStoredPhoto(product) {
  const image = product.image || product.image_path || ''
  if (!image.startsWith('data:')) return product
  return { ...product, image: '', image_path: '', imageStorageWarning: true }
}

function saveProductsSafely(products) {
  try {
    setStore('products', products)
    return products
  } catch {
    // A full localStorage quota must not stop a shopkeeper from recording
    // stock. Remove only locally embedded photos and retry the product save.
    const withoutPhotos = products.map(withoutStoredPhoto)
    setStore('products', withoutPhotos)
    return withoutPhotos
  }
}

export function localAuth({ phone, password }) {
  const users = getStore('users')
  const user = users.find(u => u.phone === phone)
  if (!user) throw { response: { data: { detail: 'User not found' } } }
  if (user.password !== password) throw { response: { data: { detail: 'Invalid password' } } }
  const token = 'local_' + genId()
  localStorage.setItem('kirana-token', token)
  setStore('current_user_id', user.id)
  return { access_token: token, user: { id: user.id, name: user.name, phone: user.phone, shop_name: user.shop_name } }
}

export function localRegister({ name, phone, password, shop_name }) {
  const users = getStore('users')
  if (users.find(u => u.phone === phone)) throw { response: { data: { detail: 'Phone already registered' } } }
  const user = { id: genId(), name, phone, password, shop_name, created_at: new Date().toISOString() }
  users.push(user)
  setStore('users', users)
  seedProducts(user.id)
  const token = 'local_' + genId()
  localStorage.setItem('kirana-token', token)
  setStore('current_user_id', user.id)
  return { access_token: token, user: { id: user.id, name: user.name, phone: user.phone, shop_name } }
}

export function localGetMe() {
  const userId = getStore('current_user_id')
  const users = getStore('users')
  const user = users.find(u => u.id === userId)
  if (!user) throw { response: { status: 401 } }
  return { id: user.id, name: user.name, phone: user.phone, shop_name: user.shop_name }
}

export function localUserUpdate(data) {
  const users = getStore('users')
  const index = users.findIndex(user => user.id === userId())
  if (index === -1) throw { response: { status: 401, data: { detail: 'User not found' } } }
  if (data.phone && users.some(user => user.phone === data.phone && user.id !== users[index].id)) {
    throw { response: { status: 400, data: { detail: 'This phone number is already in use' } } }
  }
  users[index] = { ...users[index], ...data }
  setStore('users', users)
  return { id: users[index].id, name: users[index].name, phone: users[index].phone, shop_name: users[index].shop_name }
}

function userId() { return getStore('current_user_id', null) }

function initializedSectionUsers() {
  return new Set(getStore('category_initialized_users'))
}

function ensureLocalSections() {
  const uid = userId()
  const initialized = initializedSectionUsers()
  if (!uid || initialized.has(uid)) return
  const sections = getStore('categories')
  sections.push(...DEFAULT_SECTIONS.map(([name, key]) => ({
    id: genId(), name, key, user_id: uid, created_at: new Date().toISOString(),
  })))
  initialized.add(uid)
  setStore('categories', sections)
  setStore('category_initialized_users', [...initialized])
}

export function localCategories() {
  ensureLocalSections()
  return getStore('categories')
    .filter(section => section.user_id === userId())
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function localCategoryCreate(data) {
  ensureLocalSections()
  const name = String(data.name || '').trim()
  if (!name) throw { response: { status: 400, data: { detail: 'Section name is required' } } }
  const sections = getStore('categories')
  if (sections.some(section => section.user_id === userId() && section.name.toLowerCase() === name.toLowerCase())) {
    throw { response: { status: 400, data: { detail: 'A section with this name already exists' } } }
  }
  const section = { id: genId(), name, user_id: userId(), created_at: new Date().toISOString() }
  sections.push(section)
  setStore('categories', sections)
  return section
}

export function localCategoryUpdate(id, data) {
  ensureLocalSections()
  const sections = getStore('categories')
  const index = sections.findIndex(section => String(section.id) === String(id) && section.user_id === userId())
  if (index === -1) throw { response: { status: 404, data: { detail: 'Section not found' } } }
  const name = String(data.name ?? sections[index].name).trim()
  if (!name) throw { response: { status: 400, data: { detail: 'Section name is required' } } }
  if (sections.some(section => section.user_id === userId() && section.id !== sections[index].id && section.name.toLowerCase() === name.toLowerCase())) {
    throw { response: { status: 400, data: { detail: 'A section with this name already exists' } } }
  }
  const previousName = sections[index].name
  sections[index] = { ...sections[index], ...data, name, key: name === previousName ? sections[index].key : undefined }
  setStore('categories', sections)
  if (previousName !== name) {
    setStore('products', getStore('products').map(product => (
      product.user_id === userId() && product.category === previousName ? { ...product, category: name } : product
    )))
  }
  return sections[index]
}

export function localCategoryDelete(id) {
  ensureLocalSections()
  const sections = getStore('categories')
  const section = sections.find(item => String(item.id) === String(id) && item.user_id === userId())
  if (!section) throw { response: { status: 404, data: { detail: 'Section not found' } } }
  setStore('categories', sections.filter(item => String(item.id) !== String(id) || item.user_id !== userId()))
  setStore('products', getStore('products').map(product => (
    product.user_id === userId() && product.category === section.name ? { ...product, category: 'Uncategorized' } : product
  )))
  return null
}

function seedProducts(uid) {
  const items = [
    { name: 'Dishwash Soap', category: 'Cleaning', price: 45, costPrice: 35, quantity: 50, unit: 'piece', lowStockLimit: 10 },
    { name: 'Rice (1kg)', category: 'Grocery', price: 120, costPrice: 100, quantity: 80, unit: 'kg', lowStockLimit: 20 },
    { name: 'Cooking Oil (1L)', category: 'Grocery', price: 180, costPrice: 150, quantity: 40, unit: 'liter', lowStockLimit: 10 },
    { name: 'Maggi Noodles', category: 'Food', price: 14, costPrice: 11, quantity: 100, unit: 'piece', lowStockLimit: 20 },
    { name: 'Biscuit Pack', category: 'Food', price: 25, costPrice: 20, quantity: 60, unit: 'piece', lowStockLimit: 15 },
    { name: 'Shampoo Sachet', category: 'Personal Care', price: 10, costPrice: 7, quantity: 200, unit: 'piece', lowStockLimit: 50 },
    { name: 'Toothpaste', category: 'Personal Care', price: 55, costPrice: 42, quantity: 30, unit: 'piece', lowStockLimit: 8 },
    { name: 'Tea (250g)', category: 'Grocery', price: 80, costPrice: 65, quantity: 45, unit: 'packet', lowStockLimit: 10 },
    { name: 'Sugar (1kg)', category: 'Grocery', price: 90, costPrice: 75, quantity: 60, unit: 'kg', lowStockLimit: 15 },
    { name: 'Milk (500ml)', category: 'Dairy', price: 35, costPrice: 28, quantity: 25, unit: 'packet', lowStockLimit: 10 },
  ]
  const products = items.map(p => ({ ...p, id: genId(), user_id: uid, created_at: new Date().toISOString() }))
  setStore('products', [...getStore('products'), ...products])
}

export function localProducts(params) {
  let items = getStore('products').filter(p => p.user_id === userId())
  const q = params?.search || params?.q
  if (q) {
    const ql = q.toLowerCase()
    items = items.filter(p => p.name.toLowerCase().includes(ql) || (p.category || '').toLowerCase().includes(ql))
  }
  if (params?.category) items = items.filter(p => p.category === params.category)
  return items
}

export function localProductGet(id) {
  const p = getStore('products').find(x => x.id === id && x.user_id === userId())
  if (!p) throw { response: { status: 404, data: { detail: 'Not found' } } }
  return p
}

export function localProductCreate(data) {
  const products = getStore('products')
  const item = { ...data, id: genId(), user_id: userId(), created_at: new Date().toISOString() }
  products.push(item)
  const saved = saveProductsSafely(products)
  return saved.find(product => product.id === item.id) || item
}

export function localProductUpdate(id, data) {
  const products = getStore('products')
  const idx = products.findIndex(x => x.id === id && x.user_id === userId())
  if (idx === -1) throw { response: { status: 404 } }
  products[idx] = { ...products[idx], ...data }
  const saved = saveProductsSafely(products)
  return saved[idx]
}

export function localProductDelete(id) {
  setStore('products', getStore('products').filter(x => !(x.id === id && x.user_id === userId())))
}

export function localLowStock() {
  const items = getStore('products').filter(p => p.user_id === userId())
  return items.filter(p => p.quantity <= (p.lowStockLimit ?? p.low_stock ?? 5)).sort((a, b) => a.quantity - b.quantity)
}

export function localSalesCreate(data) {
  const products = getStore('products')
  const sales = getStore('sales')
  if (data.items) {
    data.items.forEach(item => {
      const idx = products.findIndex(p => p.id === (item.product_id ?? item.productId) && p.user_id === userId())
      if (idx === -1) {
        throw { response: { status: 404, data: { detail: 'Product is no longer available' } } }
      }
      const requested = Number(item.quantity || 1)
      if (!Number.isInteger(requested) || requested < 1 || products[idx].quantity < requested) {
        throw { response: { status: 400, data: { detail: `Insufficient stock for '${products[idx].name}'` } } }
      }
      products[idx].quantity -= requested
    })
  }
  setStore('products', products)
  const sale = { id: genId(), user_id: userId(), ...data, created_at: new Date().toISOString() }
  sales.push(sale)
  setStore('sales', sales)
  if (data.paymentMethod === 'credit' && data.customerId) {
    localCreditAdd(data.customerId, { amount: data.total || 0, notes: 'Credit sale' })
  }
  return sale
}

export function localSalesGetAll(params = {}) {
  return getStore('sales')
    .filter(s => {
      if (s.user_id !== userId()) return false
      const saleDate = s.created_at?.slice(0, 10) || ''
      if (params.start_date && saleDate < params.start_date) return false
      if (params.end_date && saleDate > params.end_date) return false
      return true
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function localTodaySales() {
  const today = new Date().toISOString().slice(0, 10)
  return getStore('sales').filter(s => s.user_id === userId() && s.created_at?.startsWith(today))
}

function localTransactions(customerId) {
  const credits = getStore('credits')
    .filter(entry => entry.customer_id === customerId && entry.user_id === userId())
  const legacyPayments = getStore('payments')
    .filter(entry => entry.customer_id === customerId && entry.user_id === userId())
    .map(entry => ({ ...entry, type: 'payment' }))
  return [...credits, ...legacyPayments]
}

function localCustomerBalance(customerId) {
  return localTransactions(customerId).reduce((total, entry) => {
    const type = entry.type ?? entry.entry_type ?? 'credit'
    return total + (type === 'payment' ? -Number(entry.amount || 0) : Number(entry.amount || 0))
  }, 0)
}

function withBalance(customer) {
  return customer ? { ...customer, balance: Math.max(0, localCustomerBalance(customer.id)) } : null
}

export function localCustomers() {
  return getStore('customers').filter(c => c.user_id === userId()).map(withBalance)
}

export function localCustomerCreate(data) {
  const customers = getStore('customers')
  const c = { ...data, id: genId(), user_id: userId(), created_at: new Date().toISOString() }
  customers.push(c)
  setStore('customers', customers)
  return c
}

export function localCustomerGet(id) {
  return withBalance(getStore('customers').find(c => c.id === id && c.user_id === userId()))
}

export function localCustomerUpdate(id, data) {
  const customers = getStore('customers')
  const index = customers.findIndex(c => c.id === id && c.user_id === userId())
  if (index === -1) throw { response: { status: 404, data: { detail: 'Customer not found' } } }
  customers[index] = { ...customers[index], ...data }
  setStore('customers', customers)
  return withBalance(customers[index])
}

export function localCustomerDelete(id) {
  const customerId = String(id)
  const matchesCustomer = value => String(value) === customerId
  setStore('customers', getStore('customers').filter(customer => !matchesCustomer(customer.id) || customer.user_id !== userId()))
  setStore('credits', getStore('credits').filter(entry => !matchesCustomer(entry.customer_id) || entry.user_id !== userId()))
  setStore('payments', getStore('payments').filter(entry => !matchesCustomer(entry.customer_id) || entry.user_id !== userId()))
  return null
}

export function localCredits(userId2) {
  return localTransactions(userId2).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function localCreditAdd(customerId, data) {
  const credits = getStore('credits')
  const c = { id: genId(), customer_id: customerId, user_id: userId(), ...data, type: 'credit', created_at: new Date().toISOString() }
  credits.push(c)
  setStore('credits', credits)
  return c
}

export function localPaymentAdd(customerId, data) {
  const payments = getStore('credits')
  const p = { id: genId(), customer_id: customerId, user_id: userId(), ...data, type: 'payment', created_at: new Date().toISOString() }
  payments.push(p)
  setStore('credits', payments)
  return p
}

export function localDashboardSummary() {
  const today = new Date().toISOString().slice(0, 10)
  const sales = getStore('sales').filter(s => s.user_id === userId())
  const todaySales = sales.filter(s => s.created_at?.startsWith(today))
  const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)
  const totalCost = todaySales.reduce((sum, s) => sum + (s.total_cost ?? (s.profit != null ? s.total - s.profit : s.total * 0.7) ?? 0), 0)
  return {
    today_sales: todayTotal,
    today_profit: todayTotal - totalCost,
    order_count: todaySales.length,
    pending_credit: localCustomers().reduce((sum, customer) => sum + customer.balance, 0),
    low_stock_count: localLowStock().length,
  }
}

export function localDashboardWeekly() {
  const sales = getStore('sales').filter(s => s.user_id === userId())
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const week = days.map(d => ({ day: d, sales: 0 }))
  sales.forEach(s => {
    const d = new Date(s.created_at).getDay()
    week[d].sales += s.total || 0
  })
  return week
}

export function localNotifications() {
  const notifs = []
  const products = getStore('products').filter(p => p.user_id === userId())
  products.forEach(p => {
    if (p.quantity <= 0) notifs.push({ id: genId(), type: 'low_stock', title: `${p.name} out of stock!`, message: `Add stock for ${p.name}.`, read: false, created_at: new Date().toISOString() })
    else if (p.quantity <= (p.lowStockLimit ?? p.low_stock ?? 5)) notifs.push({ id: genId(), type: 'low_stock', title: `Low stock: ${p.name}`, message: `Only ${p.quantity} left.`, read: false, created_at: new Date().toISOString() })
  })
  return notifs
}

export function localSettingsGet() {
  return getStore('settings', { shop_name: 'My Shop', language: 'en' })
}

export function localSettingsUpdate(data) {
  const s = getStore('settings', {})
  setStore('settings', { ...s, ...data })
  return { ...s, ...data }
}

const AI_API_URL = '/ai-api'
const AI_API_KEY = 'sk-2rf9gjh4nuwi52q522se4ysy7io61448'
const AI_MODEL = 'deepseek-v4-flash-vision-exp'

export async function localAssistantChat(message) {
  const products = getStore('products').filter(p => p.user_id === userId())
  const sales = getStore('sales').filter(s => s.user_id === userId())
  const customers = getStore('customers').filter(c => c.user_id === userId())
  const today = new Date().toISOString().slice(0, 10)
  const todaySales = sales.filter(s => s.created_at?.startsWith(today))
  const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)

  // Build shop context so the AI knows about the inventory
  const shopContext = [
    `Shop: ${getStore('settings').shop_name || 'My Shop'}`,
    `Today's sales: Rs. ${todayTotal.toLocaleString()} from ${todaySales.length} orders`,
    `Products (${products.length} total):`,
    ...products.slice(0, 30).map(p => `  - ${p.name}: Rs.${p.price}, stock: ${p.quantity}, category: ${p.category || 'N/A'}`),
    `Customers (${customers.length} total):`,
    ...customers.slice(0, 15).map(c => `  - ${c.name} (${c.phone}): balance Rs.${c.balance || 0}`),
  ].join('\n')

  const hasDevanagari = /[\u0900-\u097F]/.test(message)
  const systemPrompt = `You are Kirana AI — a smart shop assistant built for a small kirana/pasal (grocery) shop in Nepal. The shopkeeper speaks ${hasDevanagari ? 'Nepali' : 'English'}. Reply in the same language the user writes in.

Here is the current shop data:\n${shopContext}\n\nYour job is to help the shopkeeper manage their shop. You can:
- Answer questions about sales, profit, stock levels, customers, and credit balances using the shop data above.
- Give advice on pricing, restocking, product selection, and shop management.
- Do quick math for the shopkeeper (e.g. margins, quantities, totals).
- Explain how to use features in the app.
- Answer general knowledge questions that are useful to a shopkeeper (e.g. "what is GST?", "how to keep milk fresh longer?", "best way to organize shelves").

Do NOT write code, create programs, or help with tasks unrelated to running a shop. Keep answers concise and practical. Use Rs. for amounts.`

  try {
    const response = await fetch(`${AI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!response.ok) throw new Error(`AI API error: ${response.status}`)
    const data = await response.json()
    return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'
  } catch (err) {
    // Fallback to local keyword-based responses if AI is unreachable
    const msg = message.toLowerCase()
    if (msg.includes('profit') || msg.includes('नाफा')) {
      const totalCost = todaySales.reduce((sum, s) => sum + (s.total_cost ?? (s.profit != null ? s.total - s.profit : s.total * 0.7) ?? 0), 0)
      return `Today's profit: Rs. ${(todayTotal - totalCost).toLocaleString()}`
    }
    if (msg.includes('low') || msg.includes('stock') || msg.includes('घट्दै')) {
      const low = products.filter(p => p.quantity <= (p.lowStockLimit ?? p.low_stock ?? 5))
      if (low.length === 0) return 'All products are well stocked!'
      return `Low stock items:\n${low.map(p => `• ${p.name}: ${p.quantity} left`).join('\n')}`
    }
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('नमस्ते')) {
      return 'Hello! I can help with sales, stock, customers, and profits. What would you like to know?'
    }
    return `I had trouble reaching the AI server. Here's what I know locally:\n• Today's sales: Rs. ${todayTotal.toLocaleString()}\n• Products: ${products.length}\n• Customers: ${customers.length}\n\nPlease try again in a moment.`
  }
}
