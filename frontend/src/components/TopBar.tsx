import { NavLink } from 'react-router-dom'

type Props = {
  onLogout: () => void
}

export default function TopBar({ onLogout }: Props) {
  return (
    <div className="topbar">
      <div className="topbarInner">
        <div className="brand">MYFIN</div>
        <div className="nav">
          <NavLink className={({ isActive }) => `navLink ${isActive ? 'navLinkActive' : ''}`} to="/dashboard">
            Dashboard
          </NavLink>
          <NavLink className={({ isActive }) => `navLink ${isActive ? 'navLinkActive' : ''}`} to="/transactions">
            Transactions
          </NavLink>
          <NavLink className={({ isActive }) => `navLink ${isActive ? 'navLinkActive' : ''}`} to="/calculator">
            Calculator
          </NavLink>
          <NavLink className={({ isActive }) => `navLink ${isActive ? 'navLinkActive' : ''}`} to="/business">
            Business
          </NavLink>
          <NavLink className={({ isActive }) => `navLink ${isActive ? 'navLinkActive' : ''}`} to="/profile">
            Profile
          </NavLink>
          <button className="navLink" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
