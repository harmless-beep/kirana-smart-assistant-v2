import { useEffect, useRef } from 'react'

/**
 * Re-run `callback` every `intervalMs` while the page is mounted.
 * Polling pauses while the tab is hidden (no point refetching data
 * nobody is looking at) and resumes when it becomes visible again.
 */
export function usePolling(callback, intervalMs = 30000) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return
    const id = setInterval(() => {
      if (document.hidden) return
      savedCallback.current()
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
