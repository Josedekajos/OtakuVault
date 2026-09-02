export default function Navbar({ userEmail, onLogout, onAddCharacter }) {
  return (
    <div className="navbar">
      <div>
        <h1 className="brand-title">OtakuVault</h1>
        <p className="navbar-subtitle">Your personal anime character collection.</p>
      </div>
      <div className="navbar-actions">
        {userEmail && <span className="navbar-user">{userEmail}</span>}
        <button className="btn btn-primary" onClick={onAddCharacter}>
          + Add Character
        </button>
        <button className="btn btn-secondary" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
