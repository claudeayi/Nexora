import { useEffect, useState } from 'react'
import { withAuth } from '../api'
import { useAuth } from '../auth'

export default function Links(){
  const { token } = useAuth()
  const http = withAuth(token)
  const [items,setItems]=useState([])
  const [destination,setDest]=useState('https://example.com')
  const [slug,setSlug]=useState('')
  const load=()=>http.get('/links').then(r=>setItems(r.data.items))
  useEffect(()=>{ load() },[])
  const add=async()=>{ await http.post('/links',{ destination, slug: slug || undefined }); setSlug(''); load() }
  return (
    <div className="container">
      <div className="card">
        <h2>Nouveau lien</h2>
        <div className="row">
          <div className="col"><input className="input" value={destination} onChange={e=>setDest(e.target.value)} /></div>
          <div className="col"><input className="input" placeholder="slug (optionnel)" value={slug} onChange={e=>setSlug(e.target.value)} /></div>
        </div>
        <div style={{marginTop:10}}><button className="btn" onClick={add}>Créer</button></div>
      </div>
      <div className="card" style={{marginTop:16}}>
        <h2>Liens</h2>
        <table className="table">
          <thead><tr><th>Slug</th><th>Destination</th><th>Créé</th></tr></thead>
          <tbody>
            {items.map(l=>(<tr key={l.id}><td>{l.slug}</td><td><a href={l.destination} target="_blank" rel="noreferrer">{l.destination}</a></td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
