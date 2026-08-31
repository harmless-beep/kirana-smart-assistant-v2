import { Search, X } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Search...', onClear }) {
  return (
    <div className="relative">
      <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-14 pl-12 pr-12 text-lg bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
      />
      {value && (
        <button
          onClick={() => { onChange(''); onClear?.() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X size={20} className="text-gray-400" />
        </button>
      )}
    </div>
  )
}
