import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const AuthCtx = createContext(null)
export function useAuth(){ return useContext(AuthCtx) }

export function AuthProvider({ children }){
  const [token,setToken]=useState(()=>localStorage.getItem('nx_token')||'')
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(!!token)

  useEffect(()=>{
    if(!token){ setLoading(false); return }
    api.get('/auth/me',{ headers:{ Authorization:`Bearer ${token}` }})
      .then(r=>setUser(r.data.user))
      .catch(()=>{ setToken(''); localStorage.removeItem('nx_token') })
      .finally(()=>setLoading(false))
  },[token])

  const login = async (email,password)=>{
    const r = await api.post('/auth/login',{ email,password })
    const t = r.data.token
    localStorage.setItem('nx_token', t)
    setToken(t); setUser(r.data.user)
  }
  const logout = ()=>{ setToken(''); setUser(null); localStorage.removeItem('nx_token') }

  const value = useMemo(()=>({ token,user,loading,login,logout }),[token,user,loading])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
