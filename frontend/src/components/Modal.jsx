import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-t-3xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto animate-slide-up safe-bottom dark:bg-gray-800">
        <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between rounded-t-3xl dark:bg-gray-800 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 -mr-2 dark:hover:bg-gray-700"
          >
            <X size={22} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
