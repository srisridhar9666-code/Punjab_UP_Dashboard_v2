/**
 * Chart colors. Values are the validated reference data-viz palette
 * (categorical slots, blue sequential ramp, blue<->red diverging pair).
 * Light and dark are each stepped for their own surface, not auto-inverted.
 */
export type Mode = 'light' | 'dark'

const SLOTS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

export const chrome = {
  light: { surface: '#ffffff', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', other: '#a3a19a', dk: '#d6d5cf' },
  dark: { surface: '#1a1a19', ink: '#ffffff', ink2: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835', other: '#6d6c67', dk: '#45443f' },
}

/** Each party keeps one slot everywhere (color follows the entity, never its rank). */
const PARTY_SLOT: Record<string, number> = {
  INC: 0, BJP: 1, AAP: 2, SAD: 3, 'Waris Punjab De': 4, 'SAD-A': 5,
  SP: 7, BSP: 6, RLD: 5, ASP: 4, AIMIM: 3,
}

export const OTHER = 'Other'
export const DK = "Don't know / no answer"

export function partyColor(party: string, mode: Mode): string {
  if (party === DK) return chrome[mode].dk
  const slot = PARTY_SLOT[party]
  if (slot === undefined) return chrome[mode].other
  return SLOTS[mode][slot]
}

export function seriesColor(i: number, mode: Mode): string {
  return SLOTS[mode][i % 8]
}

/** Blue sequential ramp, light (near zero) to dark. */
export const SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']

export function seqColor(t: number, mode: Mode): string {
  const ramp = mode === 'dark' ? SEQ.slice().reverse() : SEQ
  const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))
  return ramp[idx]
}

/** 5-point satisfaction scale: red (dissatisfied) <-> gray <-> blue (satisfied). */
export const RATING = {
  light: ['#c23b3a', '#ef9a99', '#cfcdc6', '#86b6ef', '#2a78d6'],
  dark: ['#e66767', '#8a3b3b', '#4a4945', '#1c5cab', '#3987e5'],
}

export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' }
