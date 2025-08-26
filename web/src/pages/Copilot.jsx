import { useState } from 'react'
import { withAuth } from '../api'
import { useAuth } from '../auth'

export default function Copilot(){
  const { token } = useAuth()
  const http = withAuth(token)

  const [lead,setLead]=useState({ email:'', phone:'', utmSource:'', utmCampaign:'', engagement:0.5 })
  const [score,setScore]=useState(null)

  const [gen,setGen]=useState({ product:'Nexora', audience:'PME', goal:'augmenter les conversions' })
  const [copy,setCopy]=useState(null)

  const [price,setPrice]=useState({ country:'CM', currency:'XAF', base:15 })
  const [pricing,setPricing]=useState(null)

  const predict=async()=>{ const r = await http.post('/copilot/lead/score', lead); setScore(r.data) }
  const generate=async()=>{ const r = await http.post('/copilot/generate', gen); setCopy(r.data) }
  const suggest=async()=>{ const r = await http.get(`/copilot/pricing/suggest?country=${encodeURIComponent(price.country)}&currency=${encodeURIComponent(price.currency)}&base=${encodeURIComponent(price.base)}`); setPricing(r.data) }

  return (
    <div className="container">
      <div className="card">
        <h2>Lead Scoring (IA)</h2>
        <div className="row">
          <div className="col"><input className="input" placeholder="email" value={lead.email} onChange={e=>setLead({...lead,email:e.target.value})} /></div>
          <div className="col"><input className="input" placeholder="phone" value={lead.phone} onChange={e=>setLead({...lead,phone:e.target.value})} /></div>
          <div className="col"><input className="input" placeholder="utmSource" value={lead.utmSource} onChange={e=>setLead({...lead,utmSource:e.target.value})} /></div>
          <div className="col"><input className="input" placeholder="utmCampaign" value={lead.utmCampaign} onChange={e=>setLead({...lead,utmCampaign:e.target.value})} /></div>
          <div className="col"><input className="input" type="number" step="0.01" min="0" max="1" placeholder="engagement (0..1)" value={lead.engagement} onChange={e=>setLead({...lead,engagement:e.target.value})} /></div>
        </div>
        <div style={{marginTop:10}}><button className="btn" onClick={predict}>Prédire</button></div>
        {score && <p>Probabilité: <strong>{(score.probability*100).toFixed(1)}%</strong> — Score: <strong>{score.score}</strong></p>}
      </div>

      <div className="card" style={{marginTop:16}}>
        <h2>Génération de copies</h2>
        <div className="row">
          <div className="col"><input className="input" value={gen.product} onChange={e=>setGen({...gen,product:e.target.value})} /></div>
          <div className="col"><input className="input" value={gen.audience} onChange={e=>setGen({...gen,audience:e.target.value})} /></div>
          <div className="col"><input className="input" value={gen.goal} onChange={e=>setGen({...gen,goal:e.target.value})} /></div>
        </div>
        <div style={{marginTop:10}}><button className="btn" onClick={generate}>Générer</button></div>
        {copy && <div style={{marginTop:10}}><p><strong>{copy.headline}</strong></p><p>{copy.subheadline}</p><ul>{(copy.bullets||[]).map((b,i)=><li key={i}>• {b}</li>)}</ul></div>}
      </div>

      <div className="card" style={{marginTop:16}}>
        <h2>Pricing IA</h2>
        <div className="row">
          <div className="col"><input className="input" placeholder="country" value={price.country} onChange={e=>setPrice({...price,country:e.target.value})} /></div>
          <div className="col"><input className="input" placeholder="currency" value={price.currency} onChange={e=>setPrice({...price,currency:e.target.value})} /></div>
          <div className="col"><input className="input" type="number" step="0.01" placeholder="base" value={price.base} onChange={e=>setPrice({...price,base:e.target.value})} /></div>
        </div>
        <div style={{marginTop:10}}><button className="btn" onClick={suggest}>Suggérer</button></div>
        {pricing && <p>Mensuel: <strong>{pricing.monthly} {pricing.currency}</strong> • Annuel: <strong>{pricing.annual} {pricing.currency}</strong> (facteur {pricing.factor})</p>}
      </div>
    </div>
  )
}
