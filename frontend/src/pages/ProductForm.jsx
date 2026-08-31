import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Camera, ImagePlus, Save, Minus, Plus, SlidersHorizontal, Package } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/Button'
import Modal from '../components/Modal'
import SectionManager from '../components/SectionManager'
import PageHeader from '../components/PageHeader'

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isEdit = !!id
  const imageInputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [form, setForm] = useState({
    name: '',
    barcode: '',
    price: '',
    costPrice: '',
    quantity: 10,
    category: 'Grocery',
    shelf: '',
    lowStockLimit: 5,
    expiryDate: '',
    description: '',
    image: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sections, setSections] = useState([])
  const [showSections, setShowSections] = useState(false)

  const loadProduct = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.products.getById(id)
      const p = res.data?.product || res.data
      setForm({
        name: p.name || '',
        barcode: p.barcode || '',
        price: p.price?.toString() || '',
        costPrice: p.costPrice?.toString() || '',
        quantity: p.quantity ?? p.stock ?? 0,
        category: p.category || 'Grocery',
        shelf: p.shelf?.toString() || '',
        lowStockLimit: p.lowStockLimit ?? 5,
        expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().split('T')[0] : '',
        description: p.description || '',
        image: p.image || '',
      })
    } catch {
      navigate('/products')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    if (isEdit) loadProduct()
  }, [isEdit, loadProduct])

  async function loadSections() {
    try {
      const response = await api.categories.getAll()
      setSections(response.data?.categories || response.data || [])
    } catch {
      setSections([])
    }
  }

  useEffect(() => { loadSections() }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleBarcodeEntry() {
    const barcode = window.prompt(t('scanOrTypeBarcode'), form.barcode)
    if (barcode !== null) updateForm('barcode', barcode.trim())
  }

  async function compressImage(file) {
    // The fallback image is kept in browser storage while an older API cannot
    // upload files. Keep it small enough to save reliably on phones as well.
    const sourceUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new Error('image-read-failed'))
        element.src = sourceUrl
      })
      const maxDimension = 720
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7))
      if (!blob) throw new Error('image-compress-failed')
      return new File([blob], `product-${Date.now()}.jpg`, { type: 'image/jpeg' })
    } finally {
      URL.revokeObjectURL(sourceUrl)
    }
  }

  async function uploadImageFile(file) {
    if (!file?.type?.startsWith('image/')) {
      setError(t('imageFileRequired'))
      return
    }
    // Stash the raw file so a deferred upload can retry after a cold start.
    updateForm('_imageFile', file)

    setUploadingImage(true)
    setError('')
    try {
      const optimized = await compressImage(file)
      const response = await api.products.uploadImage(optimized)
      updateForm('image', response.data.image || response.data.image_path)
    } catch (err) {
      setError(err.response?.data?.detail || t('imageUploadFailed'))
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleImageChange(event) {
    const [file] = event.target.files || []
    if (!file) return
    await uploadImageFile(file)
    event.target.value = ''
  }

  function closeCamera() {
    stopCamera()
    setCameraOpen(false)
    setCameraError('')
  }

  async function openCamera() {
    closeCamera()
    setCameraOpen(true)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('cameraUnavailable'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      await new Promise(resolve => requestAnimationFrame(resolve))
      if (!videoRef.current) throw new Error('camera-preview-unavailable')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    } catch (err) {
      stopCamera()
      setCameraError(err?.name === 'NotAllowedError' ? t('cameraPermissionDenied') : t('cameraUnavailable'))
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError(t('cameraNotReady'))
      return
    }

    setCapturing(true)
    try {
      const maximumWidth = 720
      const scale = Math.min(1, maximumWidth / video.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7))
      if (!blob) throw new Error('photo-capture-failed')
      closeCamera()
      await uploadImageFile(new File([blob], `product-camera-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    } catch {
      setCameraError(t('cameraCaptureFailed'))
    } finally {
      setCapturing(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('productNameRequired')); return }
    if (!form.price || parseFloat(form.price) <= 0) { setError(t('validPrice')); return }

    setSaving(true)
    setError('')
    try {
      // If the image upload could not complete, drop the photo from the
      // payload so the product still saves (backend rejects huge data: URLs).
      const imageBlocked = form.image?.startsWith('data:')
      const data = {
        ...form,
        price: parseFloat(form.price),
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        quantity: parseInt(form.quantity),
        lowStockLimit: parseInt(form.lowStockLimit),
        shelf: form.shelf.trim() || undefined,
        image: imageBlocked ? '' : form.image,
        image_path: imageBlocked ? '' : (form.image || undefined),
      }
      const response = isEdit ? await api.products.update(id, data) : await api.products.create(data)
      const productId = response.data?.id
      // If the photo couldn't upload (cold Render start), queue it so it
      // is pushed in the background once the backend is warm.
      if (imageBlocked && productId && form._imageFile) {
        api.queueDeferredUpload(productId, form._imageFile)
      }
      setSuccess(imageBlocked
        ? t('productSavedPhotoUploading')
        : (response.data?.imageStorageWarning ? t('productSavedWithoutPhoto') : (isEdit ? t('productUpdated') : t('productAdded'))))
      setTimeout(() => navigate('/products'), 800)
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || t('failedToSaveProduct'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500 text-lg">{t('loading')}</p></div>

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-8 dark:bg-gray-900 min-h-screen">
      <PageHeader icon={Package} title={isEdit ? t('editProduct') : t('addProduct')} onBack={() => navigate(-1)} />

      {/* Image Upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={openCamera}
        disabled={uploadingImage}
        className="w-full h-40 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl mb-6 flex items-center justify-center cursor-pointer active:bg-gray-200 dark:active:bg-gray-700 overflow-hidden disabled:cursor-wait"
      >
        {form.image ? (
          <img src={form.image} alt={t('productImage')} className="w-full h-full object-cover rounded-2xl" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Camera size={36} />
            <span className="text-base">{uploadingImage ? t('uploadingPhoto') : t('tapToAddPhoto')}</span>
          </div>
        )}
      </button>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Button variant="secondary" icon={Camera} onClick={openCamera} disabled={uploadingImage}>{t('takePhoto')}</Button>
        <Button variant="secondary" icon={ImagePlus} onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>{t('choosePhoto')}</Button>
      </div>

      <Modal isOpen={cameraOpen} onClose={closeCamera} title={t('takePhoto')}>
        {cameraError ? (
          <div className="text-center py-4">
            <Camera size={42} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 mb-4">{cameraError}</p>
            <Button fullWidth icon={ImagePlus} onClick={() => { closeCamera(); imageInputRef.current?.click() }}>
              {t('choosePhoto')}
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-[3/4] max-h-[58vh] object-cover bg-black rounded-2xl"
            />
            <p className="text-sm text-gray-500 mt-3 text-center">{t('cameraPreview')}</p>
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" fullWidth onClick={closeCamera}>{t('cancel')}</Button>
              <Button fullWidth icon={Camera} loading={capturing} onClick={capturePhoto}>{t('capturePhoto')}</Button>
            </div>
          </>
        )}
      </Modal>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('name')} *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => updateForm('name', e.target.value)}
            placeholder={t('name')}
            className="w-full h-14 px-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white"
          />
        </div>

        {/* Barcode */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('barcode')}</label>
          <div className="flex gap-2">
              <input
              type="text"
              value={form.barcode}
              onChange={e => updateForm('barcode', e.target.value)}
              placeholder={t('scanOrTypeBarcode')}
              className="flex-1 h-14 px-4 text-lg bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
            />
            <button type="button" onClick={handleBarcodeEntry} className="h-14 px-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl font-semibold text-base active:bg-blue-100 dark:active:bg-blue-900/60">
              {t('scan')}
            </button>
          </div>
        </div>

        {/* Price & Cost */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sellingPrice')} (Rs.) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-medium">Rs.</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={e => updateForm('price', e.target.value)}
                placeholder="0"
                min="0"
                className="w-full h-14 pl-12 pr-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('buyingPrice')} (Rs.)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-medium">Rs.</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.costPrice}
                onChange={e => updateForm('costPrice', e.target.value)}
                placeholder="0"
                min="0"
                className="w-full h-14 pl-12 pr-4 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quantity')}</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => updateForm('quantity', Math.max(0, parseInt(form.quantity) - 1))}
              className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center active:bg-gray-200 dark:active:bg-gray-600"
            >
              <Minus size={24} className="text-gray-600" />
            </button>
            <input
              type="number"
              value={form.quantity}
              onChange={e => updateForm('quantity', parseInt(e.target.value) || 0)}
              min="0"
              className="flex-1 h-14 text-center text-2xl font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
            />
            <button
              type="button"
              onClick={() => updateForm('quantity', parseInt(form.quantity) + 1)}
              className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center active:bg-primary-dark"
            >
              <Plus size={24} className="text-white" />
            </button>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('category')}</label>
          <div className="flex flex-wrap gap-2">
            {sections.map(section => (
              <button
                key={section.id}
                type="button"
                onClick={() => updateForm('category', section.name)}
                className={`px-4 py-2.5 rounded-full text-base font-medium transition-colors ${
                  form.category === section.name
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-700'
                }`}
              >
                {section.key ? t(section.key) : section.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowSections(true)} className="mt-3 inline-flex items-center gap-2 text-primary font-semibold text-sm"><SlidersHorizontal size={16} /> {t('manageSections')}</button>
        </div>

        {/* Shelf & Low Stock */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('shelfNumber')}</label>
            <input
              type="text"
              value={form.shelf}
              onChange={e => updateForm('shelf', e.target.value)}
              placeholder="A-3"
              className="w-full h-14 px-4 text-lg bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lowStockAlert')}</label>
            <input
              type="number"
              value={form.lowStockLimit}
              onChange={e => updateForm('lowStockLimit', e.target.value)}
              min="0"
              className="w-full h-14 px-4 text-lg bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('expiryDate')}</label>
          <input
            type="date"
            value={form.expiryDate}
            onChange={e => updateForm('expiryDate', e.target.value)}
            className="w-full h-14 px-4 text-lg bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes')}</label>
          <textarea
            value={form.description}
            onChange={e => updateForm('description', e.target.value)}
            placeholder={t('anyNotes')}
            rows={3}
            className="w-full px-4 py-3 text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white resize-none"
          />
        </div>

        {/* Errors & Success */}
        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-3"><p className="text-red-600 dark:text-red-400 text-base">{error}</p></div>}
        {success && <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-3"><p className="text-green-600 dark:text-green-400 text-base">{success}</p></div>}

        {/* Save */}
        <Button type="submit" fullWidth size="lg" loading={saving} disabled={uploadingImage} icon={Save}>
          {isEdit ? t('updateProduct') : t('addProduct')}
        </Button>
      </form>

      <SectionManager isOpen={showSections} onClose={() => setShowSections(false)} onChanged={loadSections} />
    </div>
  )
}
