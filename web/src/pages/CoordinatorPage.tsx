interface CoordinatorPageProps {
  email: string
  onSignOut: () => void
}

export function CoordinatorPage({ email, onSignOut }: CoordinatorPageProps) {
  function handleAddClass() {
    // TODO: open Add Class form
    alert('Add Class — coming soon')
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-card">
        <h2>Coordinator dashboard</h2>
        <p className="dashboard-email">{email}</p>

        <div className="coordinator-actions">
          <button type="button" className="btn-submit" onClick={handleAddClass}>
            + Add class
          </button>
        </div>

        <button type="button" className="btn-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
