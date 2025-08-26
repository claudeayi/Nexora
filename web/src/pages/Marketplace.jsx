import React, { useEffect, useState } from 'react'
import axios from 'axios'

const CATALOG = [
  { id:'ab-templates', name:'Templates A/B', desc:'Pack de 12 CTA & Héros', price:'$0', action:'installer' },
  { id:'crm-sync', name:'Sync CRM', desc:'Connecteur HubSpot/Zoho', price:'$9/mo', action:'activer' },
  { id:'fraud-guard', name:'Fraud Guard', desc:'Détection d’anomalies paiements', price:'$19/mo', action:'activer' },
  { id:'ai-copy-pro', name:'AI Copy Pro', desc:'Génération pub multi-canal', price:'$29/mo', action:'activer' },
]

export default function Marketplace(){
  const [installed, setInstalled] = useState([])

  useEffect(()=>{
    axios.get('/marketplace/installed').then(r=>setInstalled(r.data.items||[])).catch(()=>{})
  },[])

  const toggle = async (id) => {
    try {
      const inst = installed.includes(id)
      if (inst) {
        await axios.post('/marketplace/uninstall', { id })
        setInstalled(arr => arr.filter(x=>x!==id))
      } else {
        await axios.post('/marketplace/install', { id })
        setInstalled(arr => [...new Set([...arr, id])])
      }
    } catch {
      alert("Action indisponible (endpoint backend manquant).")
    }
  }

  return (
    <div className="container">
      <div className="card"><h3>Marketplace</h3><p>Extensions & connecteurs pour augmenter Nexora.</p></div>
      <div className="row" style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:12}}>
        {CATALOG.map(app=>(
          <div key={app.id} className="card" style={{flex:'1 1 320px'}}>
            <h3>{app.name}</h3>
            <p style={{color:'var(--muted)'}}>{app.desc}</p>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span className="badge">{app.price}</span>
              <button className="button btn" onClick={()=>toggle(app.id)}>
                {installed.includes(app.id) ? 'Désinstaller' : app.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
