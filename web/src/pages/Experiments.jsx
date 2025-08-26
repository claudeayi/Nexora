import { useState } from 'react'
import { withAuth } from '../api'
import { useAuth } from '../auth'

export default function Experiments(){
  const { token } = useAuth()
  const http = withAuth(token)
  const [name,setName]=useState('cta-text')
  const [assignment,setAssign]=useState(null)
  const assign=async()=>{ const r = await http.get(`/experiments/${encodeURIComponent(name)}/assign`); setAssign(r.data.variant) }
  const convert=async()=>{ if(!assignment) return; await http.post(`/experiments/${encodeURIComponent(name)}/convert`, { variant: assignment }); alert('Conversion enregistrée') }
  return (
    <div className="container">
      <div className="card">
        <h2>Expérimentation A/B</h2>
        <div className="row">
          <div className="col"><input className="input" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="col"><button className="btn" onClick={assign}>Assigner une variante</button></div>
          <div className="col"><button className="btn secondary" onClick={convert} disabled={!assignment}>Marquer conversion ({assignment||'—'})</button></div>
        </div>
      </div>
    </div>
  )
}
