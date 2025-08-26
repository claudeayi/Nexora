import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
export default function NavBar(){
  const { user, logout } = useAuth()
  return (
    <div className="nav">
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <strong>Nexora</strong>
        <span className="badge">{user?.plan?.toUpperCase()||'FREE'}</span>
      </div>
      <div style={{display:'flex',gap:8}}>
        <NavLink to="/" end className={({isActive})=>isActive?'active':''}>Dashboard</NavLink>
        <NavLink to="/leads" className={({isActive})=>isActive?'active':''}>Leads</NavLink>
        <NavLink to="/links" className={({isActive})=>isActive?'active':''}>Liens</NavLink>
        <NavLink to="/experiments" className={({isActive})=>isActive?'active':''}>A/B</NavLink>
        <NavLink to="/copilot" className={({isActive})=>isActive?'active':''}>Copilot</NavLink>
        <NavLink to="/billing" className={({isActive})=>isActive?'active':''}>Billing</NavLink>
        <NavLink to="/settings" className={({isActive})=>isActive?'active':''}>Paramètres</NavLink>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <small className="mono">{user?.email}</small>
        <button className="btn secondary" onClick={logout}>Déconnexion</button>
      </div>
    </div>
  )
}
