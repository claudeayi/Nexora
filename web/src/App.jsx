import React, { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TENANT = import.meta.env.VITE_TENANT_KEY || 'default'

// axios global
axios.defaults.baseURL = API
axios.interceptors.request.use(cfg => {
  cfg.headers = cfg.headers || {}
  cfg.headers['x-tenant'] = TENANT
  const token = localStorage.getItem('token')
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`
  return cfg
})

function Nav(){
  return (
    <div className="nav container">
      <NavLink to="/" end>Dashboard</NavLink>
      <NavLink to="/assistant">Assistant</NavLink>
      <NavLink to="/leads">Leads</NavLink>
      <NavLink to="/links">Liens</NavLink>
      <NavLink to="/experiments">A/B</NavLink>
      <NavLink to="/billing">Facturation</NavLink>
      <NavLink to="/settings" style={{marginLeft:'auto'}}>Paramètres</NavLink>
      <span className="badge">Nexora Futurist</span>
    </div>
  )
}

function Login({ onLogin }){
  const [email,setEmail]=useState('admin@example.com')
  const [password,setPassword]=useState('admin123')
  const [loading,setLoading]=useState(false)
  const nav=useNavigate()

  const submit=async(e)=>{
    e.preventDefault(); setLoading(true)
    try{
      const { data } = await axios.post('/auth/login',{email,password})
      localStorage.setItem('token', data.token)
      onLogin(data.user); nav('/')
    }catch{ alert('Échec connexion') }finally{ setLoading(false) }
  }

  return (
    <div className="container" style={{maxWidth:420}}>
      <div className="card">
        <h2>Connexion</h2>
        <form onSubmit={submit}>
          <label>Email</label>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} />
          <label style={{marginTop:10}}>Mot de passe</label>
          <input type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="button" style={{marginTop:12}} disabled={loading}>{loading?'...':'Se connecter'}</button>
        </form>
      </div>
    </div>
  )
}

function useAuth(){
  const [user,setUser]=useState(null)
  useEffect(()=>{
    const token=localStorage.getItem('token')
    if (!token) return
    axios.get('/auth/me').then(r=>setUser(r.data.user)).catch(()=>{ localStorage.removeItem('token'); setUser(null) })
  },[])
  return { user, setUser }
}

function Pager({page,pages,onPrev,onNext}){
  return (
    <div className="pager">
      <button className="button" disabled={page<=1} onClick={onPrev}>Précédent</button>
      <span className="badge">Page {page} / {pages||1}</span>
      <button className="button" disabled={pages && page>=pages} onClick={onNext}>Suivant</button>
    </div>
  )
}

function Dashboard(){
  const [stats,setStats]=useState({leadCount:0,clickCount:0,eventCount:0})
  useEffect(()=>{ axios.get('/reports/overview').then(r=>setStats(r.data)) },[])
  return (
    <div className="container">
      <div className="row">
        <div className="card" style={{flex:1}}><h3>Leads</h3><div style={{fontSize:32,fontWeight:800}}>{stats.leadCount}</div></div>
        <div className="card" style={{flex:1}}><h3>Clics</h3><div style={{fontSize:32,fontWeight:800}}>{stats.clickCount}</div></div>
        <div className="card" style={{flex:1}}><h3>Événements</h3><div style={{fontSize:32,fontWeight:800}}>{stats.eventCount}</div></div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3>Installer le pixel & SDK</h3>
        <pre><code>{`<script>window.NEXORA_API='${API}';window.NEXORA_TENANT='${TENANT}'</script>
<script src='${API}/events/sdk.js'></script>`}</code></pre>
      </div>
    </div>
  )
}

function Assistant(){
  const [goal,setGoal]=useState('500 leads / 2 semaines')
  const [audience,setAudience]=useState('PME e-commerce')
  const [product,setProduct]=useState('Nexora')
  const [out,setOut]=useState(null)
  const run=async(e)=>{ e.preventDefault(); const {data}=await axios.post('/assistant/grow',{goal,audience,product}); setOut(data) }
  return (
    <div className="container">
      <div className="card">
        <h3>Assistant (local)</h3>
        <form onSubmit={run} className="row">
          <input className="input" value={goal} onChange={e=>setGoal(e.target.value)} />
          <input className="input" value={audience} onChange={e=>setAudience(e.target.value)} />
          <input className="input" value={product} onChange={e=>setProduct(e.target.value)} />
          <button className="button">Générer</button>
        </form>
      </div>
      {out && (
        <div className="row" style={{marginTop:16}}>
          <div className="card" style={{flex:1}}><h3>Plan</h3><pre><code>{JSON.stringify(out.plan,null,2)}</code></pre></div>
          <div className="card" style={{flex:1}}><h3>Variants</h3><pre><code>{JSON.stringify(out.variants,null,2)}</code></pre></div>
          <div className="card" style={{flex:1}}><h3>UTMs</h3><pre><code>{JSON.stringify(out.utm,null,2)}</code></pre></div>
        </div>
      )}
    </div>
  )
}

function Leads(){
  const [data,setData]=useState({items:[],page:1,pages:1})
  const [form,setForm]=useState({email:'',name:'',phone:''})
  const load=p=>axios.get(`/leads?page=${p||1}&limit=10`).then(r=>setData(r.data))
  useEffect(()=>{ load(1) },[])
  const add=async(e)=>{ e.preventDefault(); const {data}=await axios.post('/leads',form); alert('Lead score: '+data.lead.score); setForm({email:'',name:'',phone:''}); load(1) }
  const del=async id=>{ await axios.delete(`/leads/${id}`); load(data.page) }
  return (
    <div className="container">
      <div className="card">
        <h3>Ajouter un lead (public)</h3>
        <form onSubmit={add} className="row">
          <input className="input" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          <input className="input" placeholder="Nom" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="input" placeholder="Téléphone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
          <button className="button">Ajouter</button>
        </form>
      </div>
      <div className="card" style={{marginTop:16}}>
        <h3>Leads</h3>
        <table className="table">
          <thead><tr><th>Date</th><th>Email</th><th>Nom</th><th>Score</th><th>Actions</th></tr></thead>
          <tbody>
            {data.items.map(l=>(
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.email}</td>
                <td>{l.name||'-'}</td>
                <td>{l.score}</td>
                <td><button className="button" onClick={()=>del(l.id)}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={data.page} pages={data.pages} onPrev={()=>load(data.page-1)} onNext={()=>load(data.page+1)} />
      </div>
    </div>
  )
}

function Links(){
  const [dest,setDest]=useState('https://example.com')
  const [slug,setSlug]=useState('demo')
  const [data,setData]=useState({items:[],page:1,pages:1})
  const load=p=>axios.get(`/links?page=${p||1}&limit=10`).then(r=>setData(r.data))
  useEffect(()=>{ load(1) },[])
  const createLink=async(e)=>{ e.preventDefault(); await axios.post('/links',{destination:dest,slug}); load(1) }
  const del=async id=>{ await axios.delete(`/links/${id}`); load(data.page) }
  return (
    <div className="container">
      <div className="card">
        <h3>Créer un lien court</h3>
        <form onSubmit={createLink} className="row">
          <input className="input" value={dest} onChange={e=>setDest(e.target.value)} />
          <input className="input" value={slug} onChange={e=>setSlug(e.target.value)} />
          <button className="button">Créer</button>
        </form>
      </div>
      <div className="card" style={{marginTop:16}}>
        <h3>Vos liens</h3>
        <table className="table">
          <thead><tr><th>Slug</th><th>Destination</th><th>Créé</th><th>Actions</th></tr></thead>
          <tbody>
            {data.items.map(l=>(
              <tr key={l.id}>
                <td><code>/r/{l.slug}</code></td>
                <td style={{maxWidth:520,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.destination}</td>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td><button className="button" onClick={()=>del(l.id)}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={data.page} pages={data.pages} onPrev={()=>load(data.page-1)} onNext={()=>load(data.page+1)} />
      </div>
    </div>
  )
}

function Experiments(){
  const [exp,setExp]=useState('cta-text')
  const [assign,setAssign]=useState(null)
  const [variant,setVariant]=useState('A')
  const doAssign=async()=>{ const {data}=await axios.get(`/experiments/${exp}/assign`); setAssign(data); setVariant(data.variant) }
  const doConvert=async()=>{ await axios.post(`/experiments/${exp}/convert`,{variant}); alert('Conversion enregistrée') }
  return (
    <div className="container">
      <div className="card">
        <h3>A/B Testing</h3>
        <div className="row">
          <input className="input" value={exp} onChange={e=>setExp(e.target.value)} />
          <button className="button" onClick={doAssign}>Assigner</button>
          <button className="button" onClick={doConvert}>Convertir</button>
        </div>
        {assign && <pre style={{marginTop:12}}><code>{JSON.stringify(assign,null,2)}</code></pre>}
      </div>
    </div>
  )
}

function Billing(){
  const [plan,setPlan]=useState('free')
  const [provider,setProvider]=useState('LOCAL')
  const [checkout,setCheckout]=useState(null)
  const load=()=>axios.get('/billing/plan').then(r=>setPlan(r.data.plan)).catch(()=>{})
  useEffect(()=>{ load() },[])
  const sub=async()=>{ await axios.post('/billing/subscribe',{plan:'pro'}); load() }
  const pay=async()=>{ const {data}=await axios.post('/billing/checkout',{plan:'pro',provider}); setCheckout(data.url) }
  return (
    <div className="container">
      <div className="card">
        <h3>Facturation</h3>
        <p>Plan actuel : <span className="badge">{plan}</span></p>
        <div className="row">
          <button className="button" onClick={sub}>Passer PRO (LOCAL)</button>
          <select className="input" value={provider} onChange={e=>setProvider(e.target.value)} style={{maxWidth:220}}>
            <option>LOCAL</option><option>STRIPE</option><option>PAYPAL</option><option>CINETPAY</option>
          </select>
          <button className="button" onClick={pay}>Créer Checkout</button>
          {checkout && <a className="button" href={checkout} target="_blank" rel="noreferrer">Ouvrir Checkout</a>}
        </div>
      </div>
    </div>
  )
}

function Settings({ onLogout }){
  const logout=()=>{ localStorage.removeItem('token'); onLogout(); location.href='/login' }
  return (
    <div className="container">
      <div className="card">
        <h3>Paramètres</h3>
        <p>API: <code>{API}</code></p>
        <p>Tenant: <code>{TENANT}</code></p>
        <button className="button" onClick={logout}>Se déconnecter</button>
      </div>
    </div>
  )
}

export default function App(){
  const { user, setUser } = useAuth()
  if (!user && !localStorage.getItem('token')) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={setUser} />} />
      </Routes>
    )
  }
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/links" element={<Links />} />
        <Route path="/experiments" element={<Experiments />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<Settings onLogout={()=>setUser(null)} />} />
        <Route path="*" element={<div className="container"><h2>404</h2></div>} />
      </Routes>
    </>
  )
}
