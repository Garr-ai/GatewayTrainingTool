/**
 * pages/ClassDetailView.tsx — Route-level wrapper for the class detail page
 *
 * Reads the `:className` route parameter (a URL slug like "BJ-APR-01"),
 * performs auth/role checks, and then converts the slug back to a display
 * name before passing it to ClassDetailPage.
 *
 * Slug ↔ Name convention:
 *   - Slug:  hyphens separate words (set by `classSlug()` in utils.ts)
 *   - Name:  spaces between words (reconstructed here by replacing `-` with ` `)
 *   - This means class names that originally contained hyphens would be ambiguous,
 *     which is why CreateClassModal disallows hyphens in class names.
 *
 * ClassDetailPage then looks up the class by name via the API, so if the slug
 * doesn't match any class name the API returns 404 and an error is shown.
 */

import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ClassDetailPage } from './ClassDetailPage'

export function ClassDetailView() {
  const { role, loading } = useAuth()
  // React Router provides the dynamic :className segment as a string
  const { className } = useParams()

  // Wait for auth to resolve before making routing decisions
  if (loading || role === null) {
    return <div className="text-sm text-slate-400 dark:text-slate-500">Loading…</div>
  }

  // Only coordinators can view class details
  if (role !== 'coordinator') {
    return <Navigate to="/dashboard" replace />
  }

  // This shouldn't happen given the route definition, but guard defensively
  if (!className) {
    return <Navigate to="/classes" replace />
  }

  // Convert slug back to display name: "BJ-APR-01" → "BJ APR 01"
  const decodedSlug = className
  const reconstructedName = decodedSlug.replace(/-/g, ' ')

  return <ClassDetailPage className={reconstructedName} />
}

