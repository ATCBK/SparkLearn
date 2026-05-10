'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    if (!initialized.current) {
      initialized.current = true
      setMatches(media.matches)
    }

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

export function useBreakpoint() {
  const isDesktop = useMediaQuery('(min-width: 1200px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1199px)')
  const isMobile = useMediaQuery('(max-width: 767px)')

  return { isDesktop, isTablet, isMobile }
}
