import { useEffect, useState } from 'react'
import { withAuth } from '../api'
import { useAuth } from '../auth'

export default function Dashboard(){
  const { token } = useAuth()
  const http = withAuth(token)
  const [overview,setOverview]=useState(null)
  useEffect(()=>{ http.get('/copilot/overview').then(r=>setOverview(r.data)).catch(()=>{}) },[])
  return (
    <div className="container">
      <div className="grid">
        <div className="card"><h3>Leads</h3><h1>{overview?.leadCount ?? '—'}</h1></div>
        <div className="card"><h3>Clics</h3><h1>{overview?.clickCount ?? '—'}</h1></div>
        <div className="card"><h3>Events</h3><h1>{overview?.eventCount ?? '—'}</h1></div>
      </div>
      <div className="card" style={{marginTop:16}}>
        <h3>Insight IA</h3>
        <p>{overview?.narrative || "Aucune donnée pour l’instant."}</p>
      </div>
    </div>
  )
}
