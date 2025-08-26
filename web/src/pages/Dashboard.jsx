import { useEffect, useMemo, useRef, useState } from 'react'
import { withAuth } from '../api'
import { useAuth } from '../auth'
import ChartCard from '../components/ChartCard'

export default function Dashboard(){
  const { token } = useAuth()
  const http = useMemo(() => withAuth(token), [token])

  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  const load = async () => {
    setLoading(true); setError('')
    try {
      // Endpoint préféré
      const r = await http.get('/copilot/overview')
      if (mounted.current) setOverview(r.data)
    } catch {
      // Fallback legacy
      try {
        const r2 = await http.get('/reports/overview')
        if (mounted.current) setOverview(r2.data)
      } catch (e) {
        if (mounted.current) setError(e?.response?.data?.error || 'Impossible de charger les statistiques')
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [http])

  const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const TENANT = import.meta.env.VITE_TENANT_KEY || 'default'

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Tableau de bord</h2>
        <div className="pager">
          <button className="button btn" onClick={load} disabled={loading}>
            {loading ? 'Chargement…' : 'Rafraîchir'}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid mt-16">
        <div className="card">
          <h3>Leads</h3>
          <div className="kpi">{loading ? '…' : (overview?.leadCount ?? '—')}</div>
          <p className="text-muted">Leads capturés (total)</p>
        </div>
        <div className="card">
          <h3>Clics</h3>
          <div className="kpi">{loading ? '…' : (overview?.clickCount ?? '—')}</div>
          <p className="text-muted">Clics suivis (liens courts)</p>
        </div>
        <div className="card">
          <h3>Événements</h3>
          <div className="kpi">{loading ? '…' : (overview?.eventCount ?? '—')}</div>
          <p className="text-muted">Événements trackés (pixel/SDK)</p>
        </div>
      </div>

      {/* Pixel & SDK install */}
      <div className="card mt-16">
        <h3>Installer le pixel & SDK</h3>
        <p className="text-muted">Ajoute ces deux lignes sur ton site pour activer le tracking Nexora :</p>
        <pre><code>{`<script>window.NEXORA_API='${API}';window.NEXORA_TENANT='${TENANT}'</script>
<script src='${API}/events/sdk.js'></script>`}</code></pre>
      </div>

      {/* Charts (Roadmap UI) */}
      <div className="row mt-16">
        <ChartCard
          title="Leads / jour"
          data={(overview?.seriesLeads || []).map((v,i)=>({ label: v.date || i, value: v.count }))}
        />
        <ChartCard
          title="Clics / jour"
          kind="bar"
          data={(overview?.seriesClicks || []).map((v,i)=>({ label: v.date || i, value: v.count }))}
        />
      </div>

      {/* IA Narrative */}
      <div className="card mt-16">
        <h3>Insight IA</h3>
        {error ? (
          <p style={{color:'#ff7b7b'}}>{error}</p>
        ) : (
          <p>{loading ? 'Analyse en cours…' : (overview?.narrative || 'Aucune donnée pour l’instant.')}</p>
        )}
      </div>
    </div>
  )
}
