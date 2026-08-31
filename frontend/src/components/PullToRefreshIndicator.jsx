import { RefreshCw } from 'lucide-react'

/**
 * Floating indicator shown during pull-to-refresh.
 * Place this as a sibling of the scrollable container.
 */
export default function PullToRefreshIndicator({ refreshing, pullDistance, threshold = 80 }) {
  const progress = Math.min(pullDistance / threshold, 1)
  const opacity = refreshing ? 1 : progress

  if (opacity <= 0) return null

  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-lift transition-opacity"
      style={{ opacity }}
    >
      <RefreshCw
        size={18}
        className={`text-primary ${refreshing ? 'animate-spin' : ''}`}
        style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
      />
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
        {refreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull down'}
      </span>
    </div>
  )
}
