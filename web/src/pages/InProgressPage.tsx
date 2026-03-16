interface InProgressPageProps {
  email: string
  onSignOut: () => void
}

export function InProgressPage({ email, onSignOut }: InProgressPageProps) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-card">
        <div className="wip-icon" aria-hidden="true">🚧</div>
        <h2>Work in progress</h2>
        <p className="dashboard-sub">
          Your dashboard is being built. Check back soon.
        </p>
        <p className="dashboard-email">{email}</p>
        <button type="button" className="btn-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
