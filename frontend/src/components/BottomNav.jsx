import { NavLink } from 'react-router-dom'
import { Home, Package, BookOpen, Bot, Settings } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { hapticTap } from '../utils/haptics'

const tabs = [
  { to: '/', icon: Home, label: 'home' },
  { to: '/products', icon: Package, label: 'products' },
  { to: '/khata', icon: BookOpen, label: 'khata' },
  { to: '/assistant', icon: Bot, label: 'assistant' },
  { to: '/settings', icon: Settings, label: 'settings' },
]

export default function BottomNav() {
  const { t } = useLanguage()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-bottom z-50">
      <div className="flex items-center justify-around h-14 sm:h-16 max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex-1 h-full flex items-center justify-center min-w-0"
            onClick={hapticTap}
          >
            {({ isActive }) => (
              <span
                className={`flex flex-col items-center justify-center gap-0.5 px-2 sm:px-5 py-1.5 rounded-2xl transition-all duration-200 ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-gray-400 active:bg-gray-100'
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className="transition-all"
                />
                <span className={`text-[10px] sm:text-xs leading-tight truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {t(label)}
                </span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
