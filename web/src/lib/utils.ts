import { PROVINCES } from '../types'
import type { Province } from '../types'

export function classSlug(name: string) {
  return name.trim().replace(/\s+/g, '-')
}

export function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export function provinceLabel(province: Province | string) {
  return PROVINCES.find(p => p.value === province)?.label ?? province
}
