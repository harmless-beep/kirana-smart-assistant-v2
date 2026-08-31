import { useState, useRef, useCallback } from 'react'

/**
 * Pull-to-refresh hook for touch devices.
 * Returns props to spread on a scrollable container + a spinner state.
 *
 * Usage:
 *   const { containerProps, refreshing } = usePullToRefresh(onRefresh)
 *   <div {...containerProps} className="overflow-y-auto">...</div>
 */
export function usePullToRefresh(onRefresh, { threshold = 80, resistance = 2.5 } = {}) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e) => {
    const el = e.currentTarget
    if (el.scrollTop > 0 || refreshing) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [refreshing])

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current) return
    const el = e.currentTarget
    if (el.scrollTop > 0) {
      pulling.current = false
      setPullDistance(0)
      return
    }
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      // Apply resistance so the pull feels rubbery
      setPullDistance(Math.min(delta / resistance, threshold * 1.5))
    }
  }, [resistance, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false
    if (pullDistance >= threshold) {
      setRefreshing(true)
      try {
        await onRefresh()
      } catch {
        // silent
      } finally {
        setRefreshing(false)
      }
    }
    setPullDistance(0)
  }, [pullDistance, threshold, onRefresh])

  const showIndicator = pullDistance > 0 || refreshing

  const containerProps = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    style: {
      transform: refreshing ? 'none' : `translateY(${pullDistance}px)`,
      transition: pullDistance > 0 ? 'none' : 'transform 0.2s ease',
    },
  }

  return { containerProps, refreshing, showIndicator, pullDistance }
}
