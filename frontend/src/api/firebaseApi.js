import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updateProfile,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import axios from 'axios'
import JsBarcode from 'jsbarcode'
import { firebaseAuth, firestore } from '../firebase'
import {
  localBindCloudUser,
  localGetProductPhoto,
  localCategories,
  localProductGet,
  localProducts,
  localLowStock,
  localCustomers,
  localCustomerGet,
  localCredits,
  localSalesGetAll,
  localTodaySales,
  localDashboardSummary,
  localDashboardWeekly,
  localNotifications,
  localSettingsGet,
} from './localDb'

const wrap = data => ({ data })
const numericOrString = value => /^-?\d+$/.test(String(value)) ? Number(value) : String(value)
const dateToday = () => new Date().toISOString().slice(0, 10)
const errorResponse = (status, detail) => Object.assign(new Error(detail), {
  response: { status, data: { detail } },
})
const RENDER_IMAGE_API_URL = (
  import.meta.env.VITE_IMAGE_API_URL ||
  import.meta.env.VITE_API_URL ||
  'https://kirana-smart-assistant.onrender.com'
).replace(/\/+$/, '')

function resolveSharedPhotoUrl(path) {
  if (!path || /^(data:|blob:|https?:\/\/)/i.test(path)) return path || ''
  return new URL(path, `${RENDER_IMAGE_API_URL}/`).href
}

async function uploadSharedPhoto(file) {
  const user = requireUser()
  if (!file) throw errorResponse(400, 'Choose a product photo first')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw errorResponse(400, 'Please upload a JPG, PNG, or WebP image')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw errorResponse(413, 'Image must be 5 MB or smaller')
  }

  const formData = new FormData()
  formData.append('image', file)
  try {
    // Allow Render's free service enough time to wake when a photo is uploaded.
    const response = await axios.post(
      `${RENDER_IMAGE_API_URL}/api/products/upload-image`,
      formData,
      {
        timeout: 70000,
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      },
    )
    const imagePath = response.data?.image_path
    if (!imagePath) throw errorResponse(502, 'The photo service returned no image URL')
    return wrap({
      image: resolveSharedPhotoUrl(imagePath),
      image_path: imagePath,
      storageWarning: false,
      shared: true,
    })
  } catch (error) {
    if (error.response?.data?.detail) throw error
    if (error.code === 'ECONNABORTED') {
      throw errorResponse(504, 'The photo server is taking too long to wake. Try the photo again in a moment.')
    }
    if (!error.response) {
      throw errorResponse(503, 'The photo server is unavailable. Your shop data can still be saved; retry the photo later.')
    }
    throw error
  }
}

let authReady
function waitForAuth() {
  if (!firebaseAuth) return Promise.resolve(null)
  if (!authReady) {
    authReady = new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(firebaseAuth, user => {
        unsubscribe()
        resolve(user)
      }, () => resolve(null))
    })
  }
  return authReady
}

function requireUser() {
  if (!firebaseAuth?.currentUser) throw errorResponse(401, 'Please sign in to continue')
  return firebaseAuth.currentUser
}

function phoneEmail(phone) {
  const bytes = new TextEncoder().encode(String(phone).trim())
  return crypto.subtle.digest('SHA-256', bytes).then(hash => {
    const value = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    return `phone-${value}@login.kirana-smart.invalid`
  })
}

function shopCollection(name, user = requireUser()) {
  return collection(firestore, 'users', user.uid, name)
}

function shopDoc(name, id, user = requireUser()) {
  return doc(firestore, 'users', user.uid, name, String(id))
}

function barcodeDoc(value, user = requireUser()) {
  return shopDoc('barcodes', encodeURIComponent(String(value)), user)
}

function record(snapshot) {
  const data = snapshot.data()
  return { ...data, id: data.id ?? numericOrString(snapshot.id) }
}

async function all(name, constraints = [], user = requireUser()) {
  const reference = shopCollection(name, user)
  const request = constraints.length ? query(reference, ...constraints) : reference
  const snapshot = await getDocs(request)
  return snapshot.docs.map(record)
}

async function allPaged(name, constraints = [], user = requireUser(), pageSize = 300) {
  const results = []
  let cursor = null
  while (true) {
    // Keep caller filters on the server. Appending the document ID gives each
    // page a stable tie-breaker when multiple records share the same value.
    const pageConstraints = [...constraints, orderBy('__name__'), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)]
    const snapshot = await getDocs(query(shopCollection(name, user), ...pageConstraints))
    const page = snapshot.docs.map(record)
    results.push(...page)
    if (snapshot.size < pageSize) return results
    cursor = snapshot.docs.at(-1)
  }
}

async function one(name, id) {
  const snapshot = await getDoc(shopDoc(name, id))
  if (!snapshot.exists()) throw errorResponse(404, `${name} record not found`)
  return record(snapshot)
}

function newRecordId() {
  return crypto.randomUUID()
}

function cleanProduct(data, uid) {
  const image = data.image ?? data.image_path ?? ''
  return {
    name: data.name,
    category: data.category || null,
    brand: data.brand || null,
    buying_price: Number(data.costPrice ?? data.buying_price ?? 0),
    selling_price: Number(data.price ?? data.selling_price ?? 0),
    quantity: Number(data.quantity ?? 0),
    shelf_number: data.shelf ?? data.shelf_number ?? null,
    barcode: data.barcode ? String(data.barcode) : null,
    expiry_date: data.expiryDate || data.expiry_date || null,
    // Spark has no Cloud Storage. Keep image bytes in this browser only.
    image_path: image && !image.startsWith('data:') ? image : null,
    description: data.description || null,
    low_stock_limit: Number(data.lowStockLimit ?? data.low_stock_limit ?? data.low_stock ?? 5),
    user_id: uid,
    updated_at: new Date().toISOString(),
  }
}

async function displayProduct(product) {
  const localImage = await localGetProductPhoto(product.id)
  return {
    ...product,
    user_id: product.legacy_user_id ?? product.user_id,
    price: product.price ?? product.selling_price ?? 0,
    costPrice: product.costPrice ?? product.buying_price ?? 0,
    shelf: product.shelf ?? product.shelf_number ?? '',
    lowStockLimit: product.lowStockLimit ?? product.low_stock_limit ?? product.low_stock ?? 5,
    expiryDate: product.expiryDate ?? product.expiry_date ?? '',
    image: resolveSharedPhotoUrl(product.image || product.image_path || localImage || ''),
    description: product.description || '',
  }
}

async function getProducts(params = {}) {
  let products = await allPaged('products', [], requireUser())
  const search = String(params.search || params.q || '').trim().toLocaleLowerCase()
  if (search) products = products.filter(item =>
    `${item.name || ''} ${item.category || ''} ${item.brand || ''} ${item.barcode || ''}`.toLocaleLowerCase().includes(search))
  if (params.category) products = products.filter(item => item.category === params.category)
  const skip = Math.max(0, Number(params.skip) || 0)
  const end = params.limit === undefined ? products.length : skip + Math.max(0, Number(params.limit) || 0)
  return Promise.all(products.slice(skip, end).map(displayProduct))
}

async function getCustomers(params = {}) {
  let customers = await allPaged('customers')
  const entries = await allPaged('credit_entries')
  const balances = new Map()
  for (const entry of entries) {
    const key = String(entry.customer_id)
    const amount = entry.entry_type === 'payment'
      ? -Number(entry.amount || 0)
      : Number(entry.remaining ?? entry.amount ?? 0)
    balances.set(key, (balances.get(key) || 0) + amount)
  }
  const search = String(params.search || '').trim().toLocaleLowerCase()
  if (search) customers = customers.filter(customer =>
    `${customer.name || ''} ${customer.phone || ''}`.toLocaleLowerCase().includes(search))
  const skip = Math.max(0, Number(params.skip) || 0)
  const end = params.limit === undefined ? customers.length : skip + Math.max(0, Number(params.limit) || 0)
  return customers.slice(skip, end).map(customer => ({ ...customer, balance: balances.get(String(customer.id)) || 0 }))
}

async function salesInRange(start, end, max = 500) {
  const constraints = []
  if (start) constraints.push(where('created_at', '>=', `${start}T00:00:00`))
  if (end) constraints.push(where('created_at', '<', `${end}T00:00:00`))
  if (start || end) constraints.push(orderBy('created_at'))
  let sales = await allPaged('sales', constraints)
  sales.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return max === Infinity ? sales : sales.slice(0, max)
}

async function includeSaleItems(sales) {
  const missing = sales.filter(sale => !Array.isArray(sale.items) || !sale.items.length)
  const savedItems = []
  for (let start = 0; start < missing.length; start += 30) {
    const ids = missing.slice(start, start + 30).map(sale => sale.id)
    if (!ids.length) continue
    savedItems.push(...await all('sale_items', [where('sale_id', 'in', ids)]))
  }
  return sales.map(sale => {
    const items = Array.isArray(sale.items) && sale.items.length
      ? sale.items
      : savedItems.filter(item => String(item.sale_id) === String(sale.id))
    return {
      ...sale,
      items: items.map(item => {
        return {
          ...item,
          product_name: item.product_name || 'Deleted product',
          cost_price: item.cost_price ?? 0,
        }
      }),
      total: sale.total ?? sale.total_amount ?? 0,
      createdAt: sale.createdAt ?? sale.created_at,
    }
  })
}

async function salesReport(start, end) {
  const sales = await salesInRange(start, end, Infinity)
  const detailed = await includeSaleItems(sales)
  const rows = detailed.flatMap(sale => sale.items.map(item => ({
    sale_id: sale.id,
    date: sale.created_at,
    name: item.product_name || `Sale #${sale.id}`,
    product_name: item.product_name || `Sale #${sale.id}`,
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total: Number(item.total_price ?? item.total ?? 0),
    amount: Number(item.total_price ?? item.total ?? 0),
    profit: (Number(item.unit_price || 0) - Number(item.cost_price || 0)) * Number(item.quantity || 0),
  })))
  const saleIds = new Set(detailed.map(sale => String(sale.id)))
  const totalSales = detailed.reduce((sum, sale) => sum + Number(sale.total_amount ?? sale.total ?? 0), 0)
  const totalProfit = detailed.reduce((sum, sale) => sum + Number(sale.profit || 0), 0)
  return {
    start_date: start,
    end_date: end,
    total_sales: totalSales,
    total_profit: totalProfit,
    totalSales,
    totalProfit,
    totalOrders: saleIds.size,
    item_count: rows.length,
    sale_count: saleIds.size,
    items: rows,
    sales: rows,
  }
}

const getDateRange = (period, date) => {
  const selected = new Date(`${date}T00:00:00`)
  let start = new Date(selected)
  let end = new Date(selected)
  if (period === 'weekly') start.setDate(start.getDate() - 6)
  if (period === 'monthly') {
    start = new Date(selected.getFullYear(), selected.getMonth(), 1)
    end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

const getUser = async () => {
  const authUser = await waitForAuth()
  if (!authUser) throw errorResponse(401, 'Please sign in again')
  const profile = await getDoc(doc(firestore, 'profiles', authUser.uid))
  if (!profile.exists()) throw errorResponse(404, 'Shop profile not found')
  const data = { ...profile.data(), id: profile.data().legacy_user_id ?? profile.data().id }
  delete data.migration_snapshot
  delete data.legacy_user_id
  await localBindCloudUser({ ...data, id: data.id ?? authUser.uid })
  return data
}

const authApi = {
  login: async ({ phone, password }) => {
    const credential = await signInWithEmailAndPassword(firebaseAuth, await phoneEmail(phone), password)
    const profile = await getDoc(doc(firestore, 'profiles', credential.user.uid))
    if (!profile.exists()) {
      await signOut(firebaseAuth)
      throw errorResponse(401, 'Account data is not available in Firebase')
    }
    const profileData = profile.data()
    const user = { ...profileData, id: profileData.legacy_user_id ?? profileData.id }
    await localBindCloudUser({ ...user, id: user.id ?? credential.user.uid })
    return wrap({ access_token: await credential.user.getIdToken(), token_type: 'bearer', user })
  },
  register: async ({ name, phone, password, shop_name }) => {
    const cleanName = String(name || '').trim()
    const cleanPhone = String(phone || '').trim()
    if (!cleanName || !cleanPhone || !String(password || '').trim()) {
      throw errorResponse(400, 'Name, phone number, and password are required')
    }
    const credential = await createUserWithEmailAndPassword(firebaseAuth, await phoneEmail(cleanPhone), password)
    try {
      const now = new Date().toISOString()
      const user = { id: credential.user.uid, name: cleanName, phone: cleanPhone, shop_name: String(shop_name || '').trim() || null, role: 'owner', created_at: now }
      await updateProfile(credential.user, { displayName: cleanName })
      const defaults = ['Grocery', 'Snacks', 'Drinks', 'Dairy', 'Personal Care', 'Household', 'Others', 'Uncategorized']
      const batch = writeBatch(firestore)
      batch.set(doc(firestore, 'profiles', credential.user.uid), user)
      defaults.forEach(categoryName => {
        const ref = shopDoc('categories', crypto.randomUUID(), credential.user)
        batch.set(ref, { id: ref.id, name: categoryName, user_id: credential.user.uid, created_at: now })
      })
      await batch.commit()
      await localBindCloudUser(user)
      return wrap({ access_token: await credential.user.getIdToken(), token_type: 'bearer', user })
    } catch (error) {
      try { await deleteUser(credential.user) } catch { /* preserve setup error; account may need manual recovery */ }
      throw error
    }
  },
  getMe: async () => wrap(await getUser()),
  updateProfile: async data => {
    const user = requireUser()
    const profileRef = doc(firestore, 'profiles', user.uid)
    const current = (await getDoc(profileRef)).data() || {}
    const next = { ...current, ...data }
    const nextPhone = String(data.phone ?? current.phone ?? '').trim()
    const phoneChanged = Boolean(nextPhone && nextPhone !== current.phone)
    if (phoneChanged) await updateEmail(user, await phoneEmail(nextPhone))
    if (data.name) await updateProfile(user, { displayName: data.name })
    next.phone = nextPhone
    next.id = user.uid
    try {
      await setDoc(profileRef, next, { merge: true })
    } catch (error) {
      if (phoneChanged) {
        try { await updateEmail(user, await phoneEmail(current.phone)) } catch { /* expose profile failure; Auth recovery may be needed */ }
      }
      throw error
    }
    const publicUser = { ...next, id: next.legacy_user_id ?? next.id }
    delete publicUser.migration_snapshot
    delete publicUser.legacy_user_id
    await localBindCloudUser(publicUser)
    return wrap(publicUser)
  },
  logout: async () => {
    await signOut(firebaseAuth)
    return wrap(null)
  },
}

const productsApi = {
  getAll: async params => wrap(await getProducts(params)),
  getById: async id => wrap(await displayProduct(await one('products', id))),
  create: async data => {
    const user = requireUser()
    const id = newRecordId()
    const ref = shopDoc('products', id, user)
    const product = { ...cleanProduct(data, user.uid), id, created_at: new Date().toISOString() }
    const reservation = product.barcode ? barcodeDoc(product.barcode, user) : null
    await runTransaction(firestore, async transaction => {
      const existing = reservation ? await transaction.get(reservation) : null
      if (existing?.exists() && String(existing.data().product_id) !== String(product.id)) {
        throw errorResponse(400, 'This barcode is already used by another product')
      }
      transaction.set(ref, product)
      if (reservation) transaction.set(reservation, { barcode: product.barcode, product_id: product.id, user_id: user.uid })
    })
    return wrap(await displayProduct(product))
  },
  uploadImage: async file => {
    return uploadSharedPhoto(file)
  },
  update: async (id, data) => {
    const user = requireUser()
    const ref = shopDoc('products', id, user)
    const current = (await getDoc(ref)).data()
    if (!current) throw errorResponse(404, 'Product not found')
    const next = { ...current, ...cleanProduct({ ...current, ...data }, user.uid), id: current.id ?? numericOrString(id) }
    const oldReservation = current.barcode ? barcodeDoc(current.barcode, user) : null
    const nextReservation = next.barcode ? barcodeDoc(next.barcode, user) : null
    await runTransaction(firestore, async transaction => {
      const freshProduct = await transaction.get(ref)
      const nextSnapshot = nextReservation && (!oldReservation || nextReservation.path !== oldReservation.path)
        ? await transaction.get(nextReservation)
        : null
      const oldSnapshot = oldReservation && (!nextReservation || nextReservation.path !== oldReservation.path)
        ? await transaction.get(oldReservation)
        : null
      if (!freshProduct.exists()) throw errorResponse(404, 'Product not found')
      if (nextSnapshot?.exists() && String(nextSnapshot.data().product_id) !== String(id)) {
        throw errorResponse(400, 'This barcode is already used by another product')
      }
      if (oldSnapshot?.exists() && String(oldSnapshot.data().product_id) === String(id)) transaction.delete(oldReservation)
      if (nextReservation) transaction.set(nextReservation, { barcode: next.barcode, product_id: next.id, user_id: user.uid })
      transaction.set(ref, next)
    })
    return wrap(await displayProduct(next))
  },
  delete: async id => {
    const user = requireUser()
    const ref = shopDoc('products', id, user)
    await runTransaction(firestore, async transaction => {
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists()) return
      const product = snapshot.data()
      const reservation = product.barcode ? barcodeDoc(product.barcode, user) : null
      const barcodeSnapshot = reservation ? await transaction.get(reservation) : null
      if (barcodeSnapshot?.exists() && String(barcodeSnapshot.data().product_id) === String(id)) transaction.delete(reservation)
      transaction.delete(ref)
    })
    return wrap(null)
  },
  search: async q => wrap(await getProducts({ search: q })),
  getLowStock: async () => wrap((await getProducts()).filter(product => Number(product.quantity) <= Number(product.lowStockLimit ?? 5))),
  getExpiring: async () => {
    const today = dateToday()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 30)
    const end = cutoff.toISOString().slice(0, 10)
    return wrap((await getProducts()).filter(product => product.expiryDate && product.expiryDate >= today && product.expiryDate <= end))
  },
}

const categoriesApi = {
  getAll: async () => wrap(await all('categories', [orderBy('name')])),
  create: async data => {
    const name = String(data.name || '').trim()
    if (!name) throw errorResponse(400, 'Section name is required')
    const current = await all('categories')
    if (current.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw errorResponse(400, 'A section with this name already exists')
    const user = requireUser()
    const id = newRecordId()
    const recordRef = shopDoc('categories', id, user)
    const category = { ...data, id, name, user_id: user.uid, created_at: new Date().toISOString() }
    await setDoc(recordRef, category)
    return wrap(category)
  },
  update: async (id, data) => {
    const ref = shopDoc('categories', id)
    const current = (await getDoc(ref)).data()
    if (!current) throw errorResponse(404, 'Section not found')
    const name = String(data.name ?? current.name).trim()
    if (!name) throw errorResponse(400, 'Section name is required')
    const sections = await all('categories')
    if (sections.some(item => String(item.id) !== String(id) && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw errorResponse(400, 'A section with this name already exists')
    const changes = []
    if (current.name !== name) {
      const products = await all('products')
      products.filter(product => product.category === current.name).forEach(product => {
        changes.push(product)
      })
    }
    if (changes.length) {
      if (changes.length > 450) throw errorResponse(400, 'This category has too many products to rename safely on Spark; update products in smaller groups first')
    }
    const batch = writeBatch(firestore)
    changes.forEach(product => batch.update(shopDoc('products', product.id), { category: name }))
    batch.update(ref, { ...data, name })
    await batch.commit()
    return wrap({ ...current, ...data, name })
  },
  delete: async id => {
    const ref = shopDoc('categories', id)
    const current = (await getDoc(ref)).data()
    if (!current) throw errorResponse(404, 'Section not found')
    const products = await all('products')
    const affected = products.filter(product => product.category === current.name)
    if (affected.length > 499) throw errorResponse(400, 'This category has too many products to delete safely on Spark; update products in smaller groups first')
    const batch = writeBatch(firestore)
    affected.forEach(product => batch.update(shopDoc('products', product.id), { category: 'Uncategorized' }))
    batch.delete(ref)
    await batch.commit()
    return wrap(null)
  },
}

const customersApi = {
  getAll: async params => wrap(await getCustomers(params)),
  getById: async id => {
    const customer = await one('customers', id)
    const entries = await allPaged('credit_entries')
    const balance = entries.filter(entry => String(entry.customer_id) === String(id))
      .reduce((sum, entry) => sum + (entry.entry_type === 'payment' ? -Number(entry.amount || 0) : Number(entry.remaining ?? entry.amount ?? 0)), 0)
    return wrap({ ...customer, balance: Math.max(0, balance) })
  },
  create: async data => {
    const user = requireUser()
    const id = newRecordId()
    const ref = shopDoc('customers', id, user)
    const customer = { ...data, id, user_id: user.uid, created_at: new Date().toISOString(), balance: 0 }
    await setDoc(ref, customer)
    return wrap(customer)
  },
  update: async (id, data) => {
    const current = await one('customers', id)
    const next = { ...current, ...data, id: current.id, user_id: requireUser().uid }
    await setDoc(shopDoc('customers', id), next)
    return wrap(next)
  },
  delete: async id => {
    await one('customers', id)
    const entries = await allPaged('credit_entries')
    const creditRefs = entries.filter(entry => String(entry.customer_id) === String(id)).map(entry => shopDoc('credit_entries', entry.id))
    const operations = [
      ...creditRefs.map(reference => batch => batch.delete(reference)),
      batch => batch.delete(shopDoc('customers', id)),
    ]
    for (let start = 0; start < operations.length; start += 450) {
      const batch = writeBatch(firestore)
      operations.slice(start, start + 450).forEach(operation => operation(batch))
      await batch.commit()
    }
    return wrap(null)
  },
  getCredits: async id => wrap((await allPaged('credit_entries')).filter(entry => String(entry.customer_id) === String(id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))),
  addCredit: async (id, data) => {
    await one('customers', id)
    const user = requireUser()
    const entryId = newRecordId()
    const ref = shopDoc('credit_entries', entryId, user)
    const now = new Date().toISOString()
    const entry = { id: entryId, customer_id: numericOrString(id), amount: Number(data.amount), paid: Number(data.paid || 0), remaining: Math.max(Number(data.amount) - Number(data.paid || 0), 0), notes: data.notes || null, entry_type: data.entry_type || 'credit', created_at: now, user_id: user.uid }
    await setDoc(ref, entry)
    return wrap(entry)
  },
  addPayment: async (id, data) => {
    const user = requireUser()
    const customer = await one('customers', id)
    const pendingEntries = (await allPaged('credit_entries')).filter(entry =>
      String(entry.customer_id) === String(customer.id) && entry.entry_type === 'credit' && Number(entry.remaining) > 0)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    if (!pendingEntries.length) throw errorResponse(400, 'No pending credit entries for this customer')
    const pendingRefs = pendingEntries.map(entry => shopDoc('credit_entries', entry.id, user))
    const paymentId = newRecordId()
    const paymentRef = shopDoc('credit_entries', paymentId, user)
    const paymentAmount = Number(data.amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw errorResponse(400, 'Payment amount must be greater than zero')
    const result = await runTransaction(firestore, async transaction => {
      const pending = await Promise.all(pendingRefs.map(ref => transaction.get(ref)))
      const available = pending.reduce((sum, snapshot) => sum + (snapshot.exists() ? Number(snapshot.data().remaining || 0) : 0), 0)
      if (paymentAmount > available) throw errorResponse(400, 'Payment exceeds the customer’s outstanding balance')
      let remaining = paymentAmount
      pending.forEach(snapshot => {
        if (!snapshot.exists()) return
        if (remaining <= 0) return
        const credit = snapshot.data()
        if (Number(credit.remaining || 0) <= 0) return
        const reduction = Math.min(Number(credit.remaining || 0), remaining)
        transaction.update(snapshot.ref, { paid: Number(credit.paid || 0) + reduction, remaining: Number(credit.remaining || 0) - reduction })
        remaining -= reduction
      })
      const applied = paymentAmount - remaining
      const payment = { id: paymentId, customer_id: numericOrString(id), amount: applied, paid: applied, remaining: 0, notes: data.notes || `Payment of ${applied}`, entry_type: 'payment', created_at: new Date().toISOString(), user_id: user.uid }
      transaction.set(paymentRef, payment)
      return payment
    })
    return wrap(result)
  },
  getOverdue: async () => wrap((await getCustomers()).filter(customer => Number(customer.balance) > 0)),
}

const salesApi = {
  getAll: async params => {
    const sales = await salesInRange(params?.start_date, params?.end_date, Infinity)
    const skip = Math.max(0, Number(params?.skip) || 0)
    const page = sales.slice(skip, skip + Math.min(500, Math.max(1, Number(params?.limit) || 100)))
    return wrap(await includeSaleItems(page))
  },
  create: async data => {
    const user = requireUser()
    if (!data.items?.length) throw errorResponse(400, 'Sale must have at least one item')
    if (data.paymentMethod === 'credit' && !data.customerId) throw errorResponse(400, 'A customer is required for a credit sale')
    if (data.items.length > 100) throw errorResponse(400, 'A sale can contain at most 100 product lines')
    const products = data.items.map(item => ({
      id: String(item.productId ?? item.product_id),
      quantity: Number(item.quantity),
      unit_price: Number(item.price ?? item.unit_price ?? 0),
    }))
    const uniqueIds = new Set(products.map(item => item.id))
    if (uniqueIds.size !== products.length) throw errorResponse(400, 'Combine duplicate products into one sale line')
    const productRefs = products.map(item => shopDoc('products', item.id, user))
    const saleId = newRecordId()
    const saleRef = shopDoc('sales', saleId, user)
    const itemIds = products.map(() => newRecordId())
    const itemRefs = itemIds.map(id => shopDoc('sale_items', id, user))
    const creditId = data.paymentMethod === 'credit' ? newRecordId() : null
    const creditRef = creditId === null ? null : shopDoc('credit_entries', creditId, user)
    const result = await runTransaction(firestore, async transaction => {
      const snapshots = await Promise.all(productRefs.map(ref => transaction.get(ref)))
      const namedCustomer = data.customerId
        ? await transaction.get(shopDoc('customers', data.customerId, user))
        : null
      if (data.customerId && !namedCustomer?.exists()) throw errorResponse(404, 'Customer not found')
      let total = 0
      let profit = 0
      const saleItems = []
      snapshots.forEach((snapshot, index) => {
        if (!snapshot.exists()) throw errorResponse(404, `Product ${products[index].id} not found`)
        const item = products[index]
        const product = snapshot.data()
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || Number(product.quantity) < item.quantity) {
          throw errorResponse(400, `Insufficient stock for '${product.name}'`)
        }
        const line = item.unit_price * item.quantity
        const cost = Number(product.buying_price ?? product.costPrice ?? 0)
        total += line
        profit += (item.unit_price - cost) * item.quantity
        transaction.update(snapshot.ref, { quantity: Number(product.quantity) - item.quantity, updated_at: new Date().toISOString() })
        saleItems.push({ id: itemIds[index], sale_id: saleId, product_id: numericOrString(snapshot.id), product_name: product.name, cost_price: cost, quantity: item.quantity, unit_price: item.unit_price, total_price: line })
      })
      const createdAt = new Date().toISOString()
      const saleCustomer = namedCustomer?.data()
      const sale = { id: saleId, user_id: user.uid, customer_id: data.customerId ? numericOrString(data.customerId) : null, customer_name: saleCustomer?.name ?? null, customer_phone: saleCustomer?.phone ?? null, total_amount: Number(total.toFixed(2)), profit: Number(profit.toFixed(2)), payment_method: data.paymentMethod || 'cash', created_at: createdAt, items: saleItems }
      transaction.set(saleRef, sale)
      saleItems.forEach((item, index) => transaction.set(itemRefs[index], { ...item, user_id: user.uid }))
      if (creditRef) transaction.set(creditRef, { id: creditId, customer_id: numericOrString(data.customerId), amount: sale.total_amount, paid: 0, remaining: sale.total_amount, notes: `Credit sale #${sale.id}`, entry_type: 'credit', created_at: createdAt, user_id: user.uid })
      return { ...sale, total: sale.total_amount, createdAt }
    })
    return wrap(result)
  },
  getToday: async () => {
    const sales = await salesInRange(dateToday(), new Date(Date.now() + 86400000).toISOString().slice(0, 10))
    return wrap({ date: dateToday(), total_sales: sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0), total_profit: sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0), sale_count: sales.length })
  },
  getWeekly: async () => wrap(await dashboardApi.getWeekly().then(result => result.data)),
  getTopProducts: async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const sales = await salesInRange(since.slice(0, 10), null, Infinity)
    const detailed = await includeSaleItems(sales)
    const top = new Map()
    detailed.forEach(sale => sale.items.forEach(item => {
      const key = String(item.product_id ?? item.product_name)
      const current = top.get(key) || { product_id: item.product_id ?? null, product_name: item.product_name || 'Deleted product', total_quantity: 0, total_revenue: 0 }
      current.total_quantity += Number(item.quantity || 0)
      current.total_revenue += Number(item.total_price || 0)
      top.set(key, current)
    }))
    return wrap([...top.values()].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 10))
  },
}

const dashboardApi = {
  getSummary: async () => {
    const start = dateToday()
    const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const [sales, products, customers] = await Promise.all([salesInRange(start, end), getProducts(), getCustomers()])
    return wrap({ today_sales: sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0), today_profit: sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0), today_sale_count: sales.length, order_count: sales.length, low_stock_count: products.filter(product => Number(product.quantity) <= Number(product.lowStockLimit || 5)).length, pending_credits: customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0), pending_credit: customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0), total_products: products.length, total_customers: customers.length })
  },
  getWeekly: async () => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 6)
    const start = startDate.toISOString().slice(0, 10)
    const end = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)
    const sales = await salesInRange(start, end, Infinity)
    const byDay = new Map()
    sales.forEach(sale => {
      const key = String(sale.created_at || '').slice(0, 10)
      const current = byDay.get(key) || { total_sales: 0, total_profit: 0 }
      current.total_sales += Number(sale.total_amount || 0)
      current.total_profit += Number(sale.profit || 0)
      byDay.set(key, current)
    })
    const daily = []
    for (let index = 0; index < 7; index++) {
      const day = new Date(startDate)
      day.setDate(day.getDate() + index)
      const date = day.toISOString().slice(0, 10)
      daily.push({ date, ...byDay.get(date) || { total_sales: 0, total_profit: 0 } })
    }
    return wrap({ start_date: start, end_date: dateToday(), daily })
  },
}

const reportsApi = {
  getDaily: async date => wrap(await salesReport(date, new Date(new Date(`${date}T00:00:00`).getTime() + 86400000).toISOString().slice(0, 10))),
  getWeekly: async (start, end) => wrap(await salesReport(start, new Date(new Date(`${end}T00:00:00`).getTime() + 86400000).toISOString().slice(0, 10))),
  getMonthly: async date => {
    const range = getDateRange('monthly', `${date}-01`)
    return wrap(await salesReport(range.start, range.end))
  },
  exportExcel: async () => { throw new Error('Use the built-in CSV fallback for Spark reports') },
  exportPdf: async () => { throw new Error('Use the browser print fallback for Spark reports') },
}

const notificationsApi = {
  getAll: async () => wrap((await all('notifications', [orderBy('created_at', 'desc'), limit(200)])).map(item => ({ ...item, read: item.read ?? item.is_read ?? false }))),
  markRead: async id => {
    const ref = shopDoc('notifications', id)
    await updateDoc(ref, { is_read: true, read: true })
    const result = await getDoc(ref)
    return wrap(record(result))
  },
  check: async () => {
    const [products, customers, current] = await Promise.all([getProducts(), getCustomers(), all('notifications')])
    const today = dateToday()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() + 30)
    const cutoff = cutoffDate.toISOString().slice(0, 10)
    const candidates = []
    products.forEach(product => {
      if (Number(product.quantity) <= Number(product.lowStockLimit ?? 5)) {
        candidates.push({ type: 'low_stock', title: `Low stock: ${product.name}`, message: `'${product.name}' has ${product.quantity} units left (limit: ${product.lowStockLimit ?? 5}). Consider reordering.` })
      }
      if (product.expiryDate && product.expiryDate >= today && product.expiryDate <= cutoff) {
        candidates.push({ type: 'expiring', title: `Expiring: ${product.name}`, message: `'${product.name}' expires on ${product.expiryDate}.` })
      }
    })
    customers.filter(customer => Number(customer.balance) > 0).forEach(customer => {
      candidates.push({ type: 'credit_due', title: `Credit due: ${customer.name}`, message: `'${customer.name}' has Rs. ${Number(customer.balance).toFixed(2)} pending.` })
    })
    const pending = candidates.filter(item => !current.some(saved => !saved.is_read && saved.title === item.title && saved.type === item.type))
    for (let start = 0; start < pending.length; start += 450) {
      const batch = writeBatch(firestore)
      pending.slice(start, start + 450).forEach(item => {
        const ref = shopDoc('notifications', crypto.randomUUID())
        batch.set(ref, { ...item, id: ref.id, user_id: requireUser().uid, is_read: false, read: false, created_at: new Date().toISOString() })
      })
      await batch.commit()
    }
    return wrap({ message: `Check complete. ${pending.length} new notification(s) created.`, new_notifications: pending.map(item => item.title) })
  },
}

const settingsApi = {
  getAll: async () => {
    const values = await all('settings')
    return wrap(values.map(item => ({ key: item.key, value: item.value })))
  },
  update: async data => {
    const current = await all('settings')
    const user = requireUser()
    const batch = writeBatch(firestore)
    Object.entries(data).forEach(([key, value]) => {
      const existing = current.find(item => item.key === key)
      const ref = shopDoc('settings', existing?.id ?? key, user)
      batch.set(ref, { id: existing?.id ?? key, key, value: String(value ?? ''), user_id: user.uid }, { merge: true })
    })
    if (Object.keys(data).length) await batch.commit()
    return settingsApi.getAll()
  },
}

const barcodeApi = {
  generate: async productId => {
    const product = await one('products', productId)
    const value = product.barcode || `KIR${String(product.id).padStart(6, '0')}`
    const svg = barcodeSvg(value)
    return wrap(new Blob([svg], { type: 'image/svg+xml' }))
  },
  scan: async barcode => {
    const reservation = await getDoc(barcodeDoc(barcode))
    if (reservation.exists()) return wrap(await displayProduct(await one('products', reservation.data().product_id)))
    const products = await all('products', [where('barcode', '==', barcode), limit(1)])
    if (!products.length) throw errorResponse(404, `No product found with barcode: ${barcode}`)
    return wrap(await displayProduct(products[0]))
  },
}

function barcodeSvg(value) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, value, { format: 'CODE128', height: 60, margin: 10, displayValue: true })
  return new XMLSerializer().serializeToString(svg)
}

export async function queueFirebaseProductPhoto(productId, file) {
  if (!productId || !file) return false
  try {
    const user = requireUser()
    const uploaded = await uploadSharedPhoto(file)
    await updateDoc(shopDoc('products', productId, user), {
      image_path: uploaded.data.image_path,
      updated_at: new Date().toISOString(),
    })
    return true
  } catch {
    return false
  }
}

export function firebasePendingPhotoCount() { return 0 }

const api = {
  firebaseMode: true,
  auth: authApi,
  products: productsApi,
  categories: categoriesApi,
  sales: salesApi,
  customers: customersApi,
  dashboard: dashboardApi,
  reports: reportsApi,
  notifications: notificationsApi,
  settings: settingsApi,
  barcode: barcodeApi,
  queueDeferredUpload: queueFirebaseProductPhoto,
}

function isOfflineError(error) {
  return ['unavailable', 'deadline-exceeded', 'network-request-failed', 'auth/network-request-failed']
    .includes(error?.code) || /network|offline|unavailable/i.test(error?.message || '')
}

function localReport(start, end) {
  const rows = localSalesGetAll({ start_date: start, end_date: end })
  const sales = rows.flatMap(sale => (sale.items || []).map(item => ({
    sale_id: sale.id,
    date: sale.created_at,
    name: item.name || item.product_name || 'Sale',
    amount: Number(item.total_price ?? item.price ?? 0) * Number(item.quantity || 1),
    profit: Number(item.profit || 0),
  })))
  return {
    totalSales: sales.reduce((sum, row) => sum + row.amount, 0),
    totalProfit: sales.reduce((sum, row) => sum + row.profit, 0),
    totalOrders: rows.length,
    sales,
  }
}

// Firestore persistence handles cached reads and queued writes. These read
// fallbacks preserve the existing device-local view if a first-time query
// cannot reach Firebase; permission and validation errors are never hidden.
const readFallbacks = {
  auth: {
    getMe: () => firebaseAuth.currentUser ? localGetMe() : Promise.reject(errorResponse(401, 'Please sign in again')),
  },
  products: {
    getAll: params => localProducts(params),
    getById: id => localProductGet(id),
    search: q => localProducts({ search: q }),
    getLowStock: () => localLowStock(),
    getExpiring: () => [],
  },
  categories: { getAll: () => localCategories() },
  sales: {
    getAll: params => localSalesGetAll(params),
    getToday: () => localTodaySales(),
    getWeekly: () => localDashboardWeekly(),
  },
  customers: {
    getAll: () => localCustomers(),
    getById: id => localCustomerGet(id),
    getCredits: id => localCredits(id),
    getOverdue: () => localCustomers().filter(customer => Number(customer.balance) > 0),
  },
  dashboard: { getSummary: () => localDashboardSummary(), getWeekly: () => localDashboardWeekly() },
  reports: {
    getDaily: date => localReport(date, date),
    getWeekly: (start, end) => localReport(start, end),
    getMonthly: date => localReport(`${date}-01`, `${date}-31`),
  },
  notifications: { getAll: () => localNotifications(), check: () => localNotifications() },
  settings: { getAll: () => Object.entries(localSettingsGet()).map(([key, value]) => ({ key, value })) },
}

for (const [group, methods] of Object.entries(readFallbacks)) {
  for (const [method, fallback] of Object.entries(methods)) {
    const operation = api[group][method]
    api[group][method] = async (...args) => {
      try {
        return await operation(...args)
      } catch (error) {
        if (!isOfflineError(error)) throw error
        return wrap(fallback(...args))
      }
    }
  }
}

export default api
