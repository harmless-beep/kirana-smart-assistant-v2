const variants = {
  default: 'bg-white dark:bg-gray-800 shadow-soft',
  success: 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800',
  warning: 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800',
  danger: 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800',
}

export default function Card({ children, className = '', onClick, variant = 'default' }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`rounded-2xl p-4 ${variants[variant]} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
      style={onClick ? { textAlign: 'left', width: '100%' } : undefined}
    >
      {children}
    </Comp>
  )
}
