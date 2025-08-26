import { useEffect, useState } from 'react'
import { withAuth } from '../api'
import { useAuth } from '../auth'

export default function Billing(){
  const { token } = useAuth()
  const http = withAuth(token)
  const [plan,setPlan]=useState('free')
  const [mode,setMode]=useState('LOCAL')

  useEffect(()=>{ http.get('/billing/plan').then(r=>{ setPlan(r.data.plan); setMode(r.data.mode) }) },[])

  const checkout=async(provider)=>{
    const r = await http.post('/billing/checkout', { provider })
    if (r.data?.url) window.location.href = r.data.url
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Facturation</h2>
        <p>Plan actuel : <strong>{plan}</strong> <span className="badge">mode {mode}</span></p>
        <div className="row">
          <button className="btn" onClick={()=>checkout('LOCAL')}>Activer PRO (Local)</button>
          <button className="btn secondary" onClick={()=>checkout('STRIPE')}>Stripe</button>
          <button className="btn secondary" onClick={()=>checkout('PAYPAL')}>PayPal</button>
          <button className="btn secondary" onClick={()=>checkout('CINETPAY')}>CinetPay</button>
        </div>
      </div>
    </div>
  )
}
