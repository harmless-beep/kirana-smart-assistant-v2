import { Loader2 } from 'lucide-react'
import { hapticTap } from '../utils/haptics'

const variants = {
  primary: 'bg-primary text-white active:bg-primary-dark',
  secondary: 'bg-gray-100 text-gray-800 active:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:active:bg-gray-600',
  accent: 'bg-accent text-white active:bg-orange-600',
  danger: 'bg-red-500 text-white active:bg-red-600',
  ghost: 'bg-transparent text-gray-600 active:bg-gray-100 dark:text-gray-300 dark:active:bg-gray-800',
  white: 'bg-white text-primary active:bg-gray-100 shadow-soft dark:bg-gray-100',
}

const sizes = {
  md: 'h-12 px-5 text-base',
  lg: 'h-14 px-6 text-lg',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon: Icon,
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={(e) => { hapticTap(); onClick?.(e) }}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-semibold
        transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : Icon ? (
        <Icon size={20} />
      ) : null}
      {children}
    </button>
  )
}
