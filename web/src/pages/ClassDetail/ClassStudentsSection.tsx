import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ClassEnrollment, EnrollmentStatus, Profile } from '../../types'

interface ClassStudentsSectionProps {
  classId: string
  className: string
}

export function ClassStudentsSection({ classId, className }: ClassStudentsSectionProps) {
  const [students, setStudents] = useState<ClassEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [status, setStatus] = useState<EnrollmentStatus>('enrolled')
  const [groupLabel, setGroupLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(
    [],
  )
  const [searchLoading, setSearchLoading] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<ClassEnrollment | null>(null)
  const [editStatus, setEditStatus] = useState<EnrollmentStatus>('enrolled')
  const [editGroupLabel, setEditGroupLabel] = useState('')

  async function loadStudents() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('loadStudents error:', error.message)
      setError('Unable to load students for this class.')
      setStudents([])
    } else {
      setStudents((data as ClassEnrollment[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStudents()
  }, [classId])

  async function searchProfiles(term: string) {
    setSearchLoading(true)
    setError(null)
    const query = supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'trainee')
      .order('full_name', { ascending: true })

    const { data, error } = term
      ? await query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      : await query.limit(25)

    if (error) {
      console.error('searchStudents error:', error.message)
      setError(error.message)
      setSearchResults([])
    } else {
      const existingEmails = new Set(
        students.map(s => s.student_email.toLowerCase()),
      )
      const raw = (data as Pick<Profile, 'id' | 'full_name' | 'email'>[]) ?? []
      const filtered = raw.filter(
        p => !existingEmails.has(p.email.toLowerCase()),
      )
      setSearchResults(filtered)
    }
    setSearchLoading(false)
  }

  async function handleEnrollStudent(profile: Pick<Profile, 'id' | 'full_name' | 'email'>) {
    setSaving(true)
    setError(null)

    const { error } = await supabase.from('class_enrollments').insert({
      class_id: classId,
      student_name: profile.full_name ?? profile.email,
      student_email: profile.email,
      status,
      group_label: groupLabel.trim() || null,
    })

    if (error) {
      setSaving(false)
      console.error('createEnrollment error:', error.message)
      setError(error.message)
      return
    }

    setStatus('enrolled')
    setGroupLabel('')
    await loadStudents()
    await searchProfiles(searchTerm)
    setSaving(false)
  }

  function openEditStudent(enrollment: ClassEnrollment) {
    setEditingEnrollment(enrollment)
    setEditStatus(enrollment.status)
    setEditGroupLabel(enrollment.group_label ?? '')
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEnrollment) return
    setError(null)

    const { error } = await supabase
      .from('class_enrollments')
      .update({
        status: editStatus,
        group_label: editGroupLabel.trim() || null,
      })
      .eq('id', editingEnrollment.id)

    if (error) {
      console.error('updateEnrollment error:', error.message)
      setError(error.message)
      return
    }

    setEditingEnrollment(null)
    loadStudents()
  }

  async function handleRemove(id: string) {
    const { error } = await supabase.from('class_enrollments').delete().eq('id', id)
    if (error) {
      console.error('removeEnrollment error:', error.message)
      setError(error.message)
      return
    }
    loadStudents()
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Students</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            View and manage students enrolled in this class, including competency groups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEnrollOpen(true)
            searchProfiles('')
          }}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
        >
          + Enroll student
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}

      {enrollOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md mx-2 max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-xl p-4">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Enroll student</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Search existing trainee profiles and add them to this class. Use groups (A/B/C) to
                  organise by competency.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEnrollOpen(false)
                  setSearchTerm('')
                  setSearchResults([])
                  setGroupLabel('')
                  setStatus('enrolled')
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </header>

            <div className="mb-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center">
              <input
                type="search"
                value={searchTerm}
                onChange={e => {
                  const val = e.target.value
                  setSearchTerm(val)
                  searchProfiles(val)
                }}
                placeholder="Search students by name…"
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <select
                value={status}
                onChange={e => setStatus(e.target.value as EnrollmentStatus)}
                className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="enrolled">Enrolled</option>
                <option value="waitlist">Waitlist</option>
                <option value="dropped">Dropped</option>
              </select>
              <input
                type="text"
                value={groupLabel}
                onChange={e => setGroupLabel(e.target.value)}
                placeholder="Group"
                className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
              {searchLoading ? (
                <p className="px-3 py-2 text-[11px] text-slate-500">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-500">No students found.</p>
              ) : (
                <ul className="divide-y divide-slate-200 text-xs">
                  {searchResults.map(p => (
                    <li
                      key={p.id}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-slate-50"
                      onClick={() => handleEnrollStudent(p)}
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {p.full_name ?? p.email}
                        </p>
                        <p className="text-[11px] text-slate-500">{p.email}</p>
                      </div>
                      <span className="text-[11px] text-indigo-600">Enroll</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {saving && (
              <p className="mt-2 text-[11px] text-slate-500">Saving enrollment…</p>
            )}
          </div>
        </div>
      )}

      {editingEnrollment && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md mx-2 max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-xl p-4">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Edit student</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Update this student&apos;s enrollment status and competency group.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEnrollment(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </header>

            <div className="mb-3 text-xs">
              <p className="font-medium text-slate-900">{editingEnrollment.student_name}</p>
              <p className="text-[11px] text-slate-500">{editingEnrollment.student_email}</p>
            </div>

            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700">
                  Status
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as EnrollmentStatus)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="enrolled">Enrolled</option>
                    <option value="waitlist">Waitlist</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </label>
              </div>
              <div>
                <label className="block font-medium text-slate-700">
                  Group (A/B/C)
                  <input
                    type="text"
                    value={editGroupLabel}
                    onChange={e => setEditGroupLabel(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. A"
                  />
                </label>
              </div>
              <div className="md:col-span-3 flex justify-end items-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEnrollment(null)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading students…</p>
      ) : students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          No students enrolled yet for <span className="font-medium text-slate-700">{className}</span>.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Email</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Status</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Group</th>
                <th className="px-3 py-2 text-right font-medium text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openEditStudent(s)}
                >
                  <td className="px-3 py-2 text-slate-900">{s.student_name}</td>
                  <td className="px-3 py-2 text-slate-600">{s.student_email}</td>
                  <td className="px-3 py-2 text-slate-600 capitalize">{s.status}</td>
                  <td className="px-3 py-2 text-slate-600">{s.group_label ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        handleRemove(s.id)
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

