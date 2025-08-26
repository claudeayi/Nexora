import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function NotificationsBell(){
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const esRef = useRef(null)

  const push = (n) => setItems(prev => [n, ...prev].slice(0, 50))

  useEffect(() => {
    // SSE par défaut (/events/stream)
    try {
      const es = new EventSource(`${API}/events/stream`)
      es.onmessage = (e) => {
        try { push(JSON.parse(e.data)) } catch {}
      }
      es.onerror = () => { es.close() }
      esRef.current = es
    } catch { /* ignore */ }

    // Fallback polling toutes les 15s
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get('/events/notifications')
        if (Array.isArray(data)) data.forEach(push)
      } catch {}
    }, 15000)

    return () => {
      if (esRef.current) esRef.current.close()
      clearInterval(t)
    }
  }, [])

  const unseen = items.filter(i => !i.seen).length

  return (
    <div style={{position:'relative'}}>
      <button className="button btn" onClick={()=>setOpen(o=>!o)} title="Notifications">
        🔔 {unseen > 0 && <span className="badge">{unseen}</span>}
      </button>
      {open && (
        <div className="card" style={{position:'absolute', right:0, top:'110%', width:360, maxHeight:360, overflow:'auto', zIndex:20}}>
          <h4>Notifications</h4>
          {items.length === 0 ? <p>Aucune notification.</p> : (
            <ul style={{listStyle:'none', padding:0, margin:0}}>
              {items.map((n,i)=>(
                <li key={i} style={{borderBottom:'1px solid var(--border)', padding:'6px 0'}}>
                  <div style={{fontWeight:600}}>{n.title || 'Événement'}</div>
                  <div style={{fontSize:12, color:'var(--muted)'}}>{n.time || ''}</div>
                  <div style={{fontSize:14}}>{n.message || JSON.stringify(n)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
