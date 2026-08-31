import { useCallback, useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import Button from './Button'
import Modal from './Modal'

const displayName = (section, t) => section.key ? t(section.key) : section.name

export default function SectionManager({ isOpen, onClose, onChanged }) {
  const { t } = useLanguage()
  const [sections, setSections] = useState([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadSections = useCallback(async () => {
    try {
      const response = await api.categories.getAll()
      const next = response.data?.categories || response.data || []
      setSections(next)
    } catch {
      setError(t('sectionSaveFailed'))
    }
  }, [t])

  useEffect(() => {
    if (isOpen) {
      setError('')
      loadSections()
    }
  }, [isOpen, loadSections])

  async function createSection(event) {
    event.preventDefault()
    if (!newName.trim()) {
      setError(t('sectionNameRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.categories.create({ name: newName.trim() })
      setNewName('')
      await loadSections()
      onChanged?.()
    } catch (err) {
      setError(err.response?.data?.detail || t('sectionSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function saveRename(section) {
    if (!editingName.trim()) {
      setError(t('sectionNameRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.categories.update(section.id, { name: editingName.trim() })
      setEditingId(null)
      await loadSections()
      onChanged?.()
    } catch (err) {
      setError(err.response?.data?.detail || t('sectionSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteSection(section) {
    if (!window.confirm(t('deleteSectionMessage', { name: displayName(section, t) }))) return
    setSaving(true)
    setError('')
    try {
      await api.categories.delete(section.id)
      await loadSections()
      onChanged?.()
    } catch (err) {
      setError(err.response?.data?.detail || t('sectionSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('shopSections')}>
      <form onSubmit={createSection} className="flex gap-2 mb-4">
        <input value={newName} onChange={event => setNewName(event.target.value)} maxLength="100" placeholder={t('newSectionName')} className="min-w-0 flex-1 h-12 px-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <Button type="submit" icon={Plus} loading={saving}>{t('addSection')}</Button>
      </form>

      {error && <p className="mb-3 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600">{error}</p>}

      <div className="max-h-[48vh] overflow-y-auto flex flex-col gap-2">
        {sections.map(section => (
          <div key={section.id} className="flex items-center gap-2 rounded-xl bg-gray-50 p-2">
            {editingId === section.id ? (
              <input value={editingName} onChange={event => setEditingName(event.target.value)} maxLength="100" className="min-w-0 flex-1 h-10 px-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            ) : (
              <span className="flex-1 min-w-0 px-2 font-medium text-gray-800 truncate">{displayName(section, t)}</span>
            )}
            {editingId === section.id ? (
              <>
                <button type="button" aria-label={t('save')} onClick={() => saveRename(section)} disabled={saving} className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center"><Check size={18} /></button>
                <button type="button" aria-label={t('cancel')} onClick={() => setEditingId(null)} disabled={saving} className="w-10 h-10 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center"><X size={18} /></button>
              </>
            ) : (
              <>
                <button type="button" aria-label={t('renameSection')} onClick={() => { setEditingId(section.id); setEditingName(section.name); setError('') }} disabled={saving} className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Pencil size={17} /></button>
                <button type="button" aria-label={t('deleteSection')} onClick={() => deleteSection(section)} disabled={saving} className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><Trash2 size={17} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
