import { NavLink } from 'react-router-dom'
import { Home, Package, BookOpen, Wrench, Settings } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const tabs = [
  { to: '/', icon: Home, label: 'home' },
  { to: '/products', icon: Package, label: 'products' },
  { to: '/khata', icon: BookOpen, label: 'khata' },
  { to: '/tools', icon: Wrench, label: 'tools' },
  { to: '/settings', icon: Settings, label: 'settings' },
]

export default function BottomNav() {
  const { t } = useLanguage()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className="transition-all"
                />
                <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {t(label)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
