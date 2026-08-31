import { ArrowLeft } from 'lucide-react'

/**
 * Consistent friendly page header: a green gradient banner with an icon,
 * optional subtitle, optional back button, and optional action slot.
 * Matches the Home hero so every page feels like part of the same app.
 */
export default function PageHeader({ icon: Icon, title, subtitle, action, onBack, className = '' }) {
  return (
    <div className={`mb-5 rounded-3xl bg-gradient-to-br from-primary via-emerald-600 to-teal-600 p-4 text-white shadow-lift flex items-center gap-3 ${className}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 active:bg-white/25 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      {Icon && (
        <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Icon size={22} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-white truncate">{title}</h1>
        {subtitle && <p className="text-white/75 text-sm truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}
