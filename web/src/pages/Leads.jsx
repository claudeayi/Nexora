import { useEffect, useState } from 'react'
import { withAuth } from '../api'
import { useAuth } from '../auth'

export default function Leads(){
  const { token } = useAuth()
  const http = withAuth(token)
  const [items,setItems]=useState([])
  const [email,setEmail]=useState('')
  const [name,setName]=useState('')
  const [phone,setPhone]=useState('')
  const load=()=>http.get('/leads').then(r=>setItems(r.data.items))
  useEffect(()=>{ load() },[])
  const add=async()=>{ await http.post('/leads',{ email,name,phone }); setEmail(''); setName(''); setPhone(''); load() }
  return (
    <div className="container">
      <div className="card">
        <h2>Créer un lead</h2>
        <div className="row">
          <div className="col"><input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="col"><input className="input" placeholder="Nom" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="col"><input className="input" placeholder="Téléphone" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
        </div>
        <div style={{marginTop:10}}><button className="btn" onClick={add}>Ajouter</button></div>
      </div>
      <div className="card" style={{marginTop:16}}>
        <h2>Liste des leads</h2>
        <table className="table">
          <thead><tr><th>Email</th><th>Nom</th><th>Score</th><th>Créé</th></tr></thead>
          <tbody>
            {items.map(l=>(<tr key={l.id}><td>{l.email}</td><td>{l.name||'—'}</td><td>{l.score}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
