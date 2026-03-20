/**
 * pages/InProgressPage.tsx — "Work in progress" placeholder for non-coordinator users
 *
 * Shown to trainers and trainees when they log in. Their role-specific dashboard
 * (e.g. drill logging, schedule view) has not been built yet, so this page acts
 * as a friendly placeholder that confirms they're logged in and provides a sign-out
 * option.
 *
 * Rendered by DashboardView when role !== 'coordinator'.
 */

interface InProgressPageProps {
  email: string        // Displayed so the user knows which account is signed in
  onSignOut: () => void
}

export function InProgressPage({ email, onSignOut }: InProgressPageProps) {
  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-lg p-8 flex flex-col items-center gap-4 text-center">
        <div className="text-4xl" aria-hidden="true">🚧</div>
        <h2 className="text-lg font-semibold text-slate-900">Work in progress</h2>
        <p className="text-sm text-slate-600">
          Your dashboard is being built. Check back soon.
        </p>
        <p className="text-xs text-slate-500">{email}</p>
        <button
          type="button"
          className="mt-2 inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-slate-400"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
