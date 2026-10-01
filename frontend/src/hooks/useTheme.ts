import { useEffect, useSyncExternalStore } from 'react'
import type { Mode } from '@/lib/colors'

export type ThemePref = 'light' | 'dark' | 'system'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')
let pref: ThemePref = (() => {
  try {
    return (localStorage.getItem('theme') as ThemePref) || 'system'
  } catch {
    return 'system'
  }
})()
const listeners = new Set<() => void>()

function resolved(): Mode {
  return pref === 'system' ? (media().matches ? 'dark' : 'light') : pref
}

function apply() {
  document.documentElement.classList.toggle('dark', resolved() === 'dark')
  listeners.forEach((l) => l())
}

export function setThemePref(p: ThemePref) {
  pref = p
  try {
    localStorage.setItem('theme', p)
  } catch {
    /* private mode */
  }
  apply()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Returns [preference, resolved mode]. Charts re-render when the mode changes. */
export function useTheme(): [ThemePref, Mode] {
  useEffect(() => {
    const m = media()
    m.addEventListener('change', apply)
    return () => m.removeEventListener('change', apply)
  }, [])
  const p = useSyncExternalStore(subscribe, () => pref)
  const mode = useSyncExternalStore(subscribe, resolved)
  return [p, mode]
}
