/**
 * lib/utils.ts — General-purpose frontend utility functions
 *
 * Small, pure helper functions shared across multiple components.
 * Keep this file free of React imports; it should be plain TypeScript
 * so it can be used in both component and non-component contexts.
 */

import { PROVINCES } from '../types'
import type { Province } from '../types'

/**
 * Converts a class name to a URL-safe slug by replacing whitespace with hyphens.
 * Used to build the route `/classes/:className` from a class name like "BJ APR 01".
 * The reverse operation (slug → name) is done in ClassDetailView.tsx by replacing
 * hyphens with spaces. NOTE: This means class names with pre-existing hyphens will
 * be ambiguous; the class name validator in CreateClassModal disallows hyphens.
 */
export function classSlug(name: string) {
  return name.trim().replace(/\s+/g, '-')
}

/**
 * Formats a 24-hour time string (e.g. "14:30") into a 12-hour AM/PM string (e.g. "2:30 PM").
 * Used in schedule displays. Assumes the input is a valid "HH:MM" string.
 * The `|| 12` handles midnight (0 % 12 === 0, which should display as 12).
 */
export function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/**
 * Returns the full province name for a province code (e.g. "BC" → "British Columbia").
 * Falls back to the raw code if no matching province is found in the PROVINCES list,
 * which prevents crashes if a future province code is added to the DB before the frontend.
 */
export function provinceLabel(province: Province | string) {
  return PROVINCES.find(p => p.value === province)?.label ?? province
}
