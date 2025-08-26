import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import './styles.css'

// Récupère l’élément root (avec fallback)
const container = document.getElementById('root')
if (!container) {
  throw new Error("❌ Élément #root introuvable dans index.html")
}
const root = createRoot(container)

root.render(
  <React.StrictMode>
    {/* BrowserRouter = navigation côté client */}
    <BrowserRouter>
      {/* AuthProvider = gestion du contexte utilisateur */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
