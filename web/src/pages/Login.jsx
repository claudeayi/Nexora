import { useState } from 'react'
import { useAuth } from '../auth'
export default function Login(){
  const { login } = useAuth()
  const [email,setEmail]=useState('admin@example.com')
  const [password,setPassword]=useState('admin123')
  const [loading,setLoading]=useState(false)
  const [err,setErr]=useState('')
  const submit=async(e)=>{e.preventDefault();setErr('');setLoading(true);
    try{ await login(email,password) }catch(ex){ setErr(ex?.response?.data?.error||'Erreur'); }finally{ setLoading(false) } }
  return (
    <div className="container">
      <div className="card" style={{maxWidth:420, margin:'80px auto'}}>
        <h2>Connexion</h2>
        <form onSubmit={submit}>
          <label>Email</label>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} />
          <label>Mot de passe</label>
          <input type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} />
          {err && <p style={{color:'#ff7b7b'}}>{err}</p>}
          <div style={{marginTop:12}}>
            <button className="btn" disabled={loading}>{loading?'…':'Se connecter'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
