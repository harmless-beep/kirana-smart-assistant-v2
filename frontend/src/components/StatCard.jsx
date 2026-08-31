import { TrendingUp, TrendingDown } from 'lucide-react'

const colorMap = {
  green: 'bg-green-50 text-green-700',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
}

const iconColorMap = {
  green: 'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
}

export default function StatCard({ title, value, icon: Icon, color = 'green', trend, subtitle }) {
  return (
    <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 ${colorMap[color] || colorMap.green}`}>
      <div className="flex items-start justify-between mb-1.5 sm:mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium opacity-75 truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColorMap[color] || iconColorMap.green}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium mt-2 ${trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
          {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{trend === 'up' ? 'Trending up' : 'Trending down'}</span>
        </div>
      )}
    </div>
  )
}
