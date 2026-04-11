import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/apiClient'
import { SkeletonCard } from '../components/Skeleton'
import { RoleRequestsSection } from './RoleRequestsSection'
import { PROVINCES, type Profile } from '../types'

const inputClass = 'mt-1 w-full bg-gw-elevated border border-white/10 rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'
const fieldLabel = 'text-xs font-medium text-slate-400 uppercase tracking-wider'

export function SettingsContent() {
  const { email, signOut } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editProvince, setEditProvince] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.profiles.me()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function startEditing() {
    if (!profile) return
    setEditName(profile.full_name ?? '')
    setEditProvince(profile.province ?? '')
    setEditing(true)
  }

  function cancelEditing() { setEditing(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.profiles.update({
        full_name: editName,
        province: editProvince || undefined,
      })
      setProfile(updated)
      setEditing(false)
      toast('Profile updated', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const provinceLabel = (code: Profile['province']) =>
    PROVINCES.find((p) => p.value === code)?.label ?? null

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const memberSince = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Settings</h2>
          <p className="mt-0.5 text-sm text-slate-300">App and account settings</p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="text-xs uppercase tracking-wide text-slate-500">Coordinator</span>
          <span className="text-xs text-slate-300">{email}</span>
        </div>
      </header>

      {loading ? (
        <div className="mt-6"><SkeletonCard lines={5} /></div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* Profile section */}
          <section className="bg-gw-surface rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Profile</h3>
              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-md bg-gw-surface text-slate-200 border border-white/10 px-3 py-1 text-xs font-semibold hover:bg-gw-elevated transition-colors duration-150"
                >
                  Edit profile
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className={fieldLabel}>Full name</span>
                {editing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={inputClass}
                    placeholder="Enter your name"
                  />
                ) : profile?.full_name ? (
                  <p className="text-sm text-slate-200 mt-1">{profile.full_name}</p>
                ) : (
                  <p className="text-sm italic text-slate-500 mt-1">Not set</p>
                )}
              </div>

              <div>
                <span className={fieldLabel}>Email</span>
                <p className="text-sm text-slate-200 mt-1">{profile?.email ?? email}</p>
              </div>

              <div>
                <span className={fieldLabel}>Role</span>
                <p className="text-sm text-slate-200 mt-1">
                  {profile?.role ? capitalize(profile.role) : 'Unknown'}
                </p>
              </div>

              <div>
                <span className={fieldLabel}>Province</span>
                {editing ? (
                  <select
                    value={editProvince}
                    onChange={e => setEditProvince(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select province</option>
                    {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                ) : profile?.province ? (
                  <p className="text-sm text-slate-200 mt-1">{provinceLabel(profile.province)}</p>
                ) : (
                  <p className="text-sm italic text-slate-500 mt-1">Not set</p>
                )}
              </div>

              <div>
                <span className={fieldLabel}>Member since</span>
                <p className="text-sm text-slate-200 mt-1">
                  {profile?.created_at ? memberSince(profile.created_at) : '---'}
                </p>
              </div>
            </div>

            {editing && (
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="rounded-md bg-gw-surface text-slate-200 border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-gw-elevated transition-colors duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition-all duration-150 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </section>

          {/* Role Requests section */}
          <section className="bg-gw-surface rounded-[10px] p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Role Requests</h3>
            <RoleRequestsSection />
          </section>

          {/* Account section */}
          <section className="bg-gw-surface rounded-[10px] p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Account</h3>
            <p className="text-sm text-slate-400 mb-3">Sign out of your coordinator account.</p>
            <button
              type="button"
              className="rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/25 px-3 py-1.5 text-sm font-semibold hover:bg-rose-500/20 transition-colors duration-150"
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
