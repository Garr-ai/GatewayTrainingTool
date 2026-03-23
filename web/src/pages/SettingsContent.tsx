/**
 * pages/SettingsContent.tsx — Settings page (coordinator only)
 *
 * Displays the authenticated user's profile in a read-only card and provides
 * a sign-out action. Profile data is fetched from the API on mount.
 *
 * Accessed via the Settings link pinned to the bottom of CoordinatorLayout's sidebar.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/apiClient'
import { SkeletonCard } from '../components/Skeleton'
import { PROVINCES, type Profile } from '../types'

export function SettingsContent() {
  const { email, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.profiles.me()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const provinceLabel = (code: Profile['province']) =>
    PROVINCES.find((p) => p.value === code)?.label ?? null

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const memberSince = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
          <p className="mt-0.5 text-xs text-slate-500">App and account settings</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">Coordinator</span>
          <span className="text-xs text-slate-800">{email}</span>
        </div>
      </header>

      {loading ? (
        <div className="mt-6"><SkeletonCard lines={5} /></div>
      ) : (
        <div className="mt-6 space-y-5">
          {/* ── Profile Section ── */}
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Profile</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Full name</span>
                {profile?.full_name ? (
                  <p className="text-sm text-slate-900">{profile.full_name}</p>
                ) : (
                  <p className="text-sm italic text-slate-400">Not set</p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Email</span>
                <p className="text-sm text-slate-900">{profile?.email ?? email}</p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Role</span>
                <p className="text-sm text-slate-900">
                  {profile?.role ? capitalize(profile.role) : 'Unknown'}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Province</span>
                {profile?.province ? (
                  <p className="text-sm text-slate-900">{provinceLabel(profile.province)}</p>
                ) : (
                  <p className="text-sm italic text-slate-400">Not set</p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Member since</span>
                <p className="text-sm text-slate-900">
                  {profile?.created_at ? memberSince(profile.created_at) : '---'}
                </p>
              </div>
            </div>
          </section>

          {/* ── Account Section ── */}
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Account</h3>
            <p className="text-sm text-slate-500 mb-3">Sign out of your coordinator account.</p>
            <button
              type="button"
              className="rounded-md border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
              onClick={signOut}
            >
              Sign out
            </button>
          </section>
        </div>
      )}
    </>
  )
}
