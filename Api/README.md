# 🚀 Nexora Futurist – Copilote Full IA

**Nexora Futurist** est une plateforme **SaaS multi-tenant** de **growth hacking & copilote numérique**, intégrant l’IA à tous les niveaux :  
- 📈 **Tracking & analytics temps réel** (Pixel, SDK, SSE, notifications)  
- 🧪 **A/B Testing autonome** (multi-variantes, Thompson Sampling)  
- 🎯 **Lead capture & scoring prédictif** (IA + fallback heuristique)  
- 💳 **Facturation multi-provider** (LOCAL, Stripe, PayPal, CinetPay)  
- 🤖 **Copilot IA** (génération de copies, pricing dynamique, insights narratifs)  
- 🛠 **Marketplace extensible** (extensions UI/backend)  

---

## 🏗️ Stack technique

- **Backend API** : Node.js (Express) + Prisma + MySQL  
- **AI Service** : FastAPI (Python) + scikit-learn + NumPy  
- **Frontend Web** : React (Vite) + Axios + Router  
- **Infra** : Docker multi-stage (API, Frontend, AI) + Caddy (SSL)  
- **Sécurité** : JWT auth, Helmet, Ledger immuable (ProofLedger)  
- **Temps réel** : SSE (`/events/stream`) + fallback polling  

---

## 📂 Structure

```text
nexora-futurist/
├── api/                    # Backend Node.js (Express + Prisma + Billing + Multi-tenant)
│   ├── app.js              # Entrée serveur Express
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma   # Modèle DB (Tenant, User, Lead, Event, etc.)
│   │   └── seed.js         # Script de seed (admin + tenant default)
│   ├── routes/             # Routes REST (auth, leads, links, events, copilot, billing, etc.)
│   ├── middlewares/        # Auth, resolveTenant, error handler
│   ├── lib/                # Prisma client, scoring, notify (SSE), utils
│   └── Dockerfile
│
├── ai/                     # Microservice IA (FastAPI)
│   ├── app.py              # Endpoints IA (lead scoring, A/B select, pricing, copy gen, anomalies)
│   ├── requirements.txt
│   └── Dockerfile
│
├── web/                    # Frontend React (Vite + Router)
│   ├── src/
│   │   ├── App.jsx         # Routes principales
│   │   ├── main.jsx        # Entrée Vite + BrowserRouter
│   │   ├── styles.css      # Thème clair/sombre
│   │   ├── api.js          # Axios wrapper (tenant + token)
│   │   ├── auth.js         # Contexte Auth
│   │   ├── components/     # NavBar, NotificationsBell, ChartCard, ThemeToggle, etc.
│   │   └── pages/          # Dashboard, Leads, Links, Experiments, Billing, Copilot, Marketplace, Settings
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── Dockerfile
│
├── infra/
│   └── caddy/              # Proxy SSL (Caddyfile + certbot si besoin)
│
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── docker-compose.ssl.yml
└── README.md
