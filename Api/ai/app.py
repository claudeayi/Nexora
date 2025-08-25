from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import math, numpy as np
from sklearn.ensemble import IsolationForest

app = FastAPI(title="Nexora AI Service", version="1.0.0")

class LeadFeatures(BaseModel):
    email_domain_corporate: bool = False
    has_phone: bool = False
    utm_source_known: bool = False
    utm_campaign_pro: bool = False
    engagement_score: float = 0.0  # 0..1

class VariantsStats(BaseModel):
    name: str
    views: int
    conversions: int

class ABSelectIn(BaseModel):
    variants: List[VariantsStats]

class TimeSeries(BaseModel):
    values: List[float]
    z_thresh: float = 2.5

class GenCopyIn(BaseModel):
    product: str
    audience: str
    goal: str

class PricingIn(BaseModel):
    currency: str = "USD"
    country: Optional[str] = None
    base_monthly: float = 19.0

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.post("/predict/lead")
def predict_lead(f: LeadFeatures):
    # petit modèle logistique "local" (sans entraînement) + transform sigmoïde
    w = np.array([1.2, 1.0, 0.6, 0.8, 1.6])  # poids heuristiques
    x = np.array([
        1.0 if f.email_domain_corporate else 0.0,
        1.0 if f.has_phone else 0.0,
        1.0 if f.utm_source_known else 0.0,
        1.0 if f.utm_campaign_pro else 0.0,
        max(0.0, min(1.0, f.engagement_score))
    ])
    z = float(np.dot(w, x) - 2.0)  # biais
    p = 1.0 / (1.0 + math.exp(-z))
    score100 = round(p * 100, 2)
    return {"probability": p, "score": score100}

@app.post("/ab/select")
def ab_select(req: ABSelectIn):
    # Thompson Sampling (Beta)
    best = None
    best_sample = -1.0
    for v in req.variants:
        a = 1 + max(0, v.conversions)
        b = 1 + max(0, v.views - v.conversions)
        sample = np.random.beta(a, b)
        if sample > best_sample:
            best = v.name
            best_sample = sample
    return {"variant": best, "sample": best_sample}

@app.post("/anomaly/events")
def anomaly_events(ts: TimeSeries):
    vals = np.array(ts.values, dtype=float)
    if len(vals) < 5:
        return {"anomalies": []}
    mean = float(vals.mean())
    std = float(vals.std() if vals.std() > 0 else 1.0)
    z = (vals - mean) / std
    idx = [i for i, zz in enumerate(z) if abs(zz) >= ts.z_thresh]
    return {"anomalies": idx, "mean": mean, "std": std}

@app.post("/generate/copy")
def generate_copy(data: GenCopyIn):
    # Génération locale simple (promptless). Pour LLM externe, brancher ici.
    headline = f"{data.product} : votre copilote {data.audience}"
    sub = f"Objectif : {data.goal}. Démarrez en 2 minutes, suivez et optimisez automatiquement."
    bullets = [
        "Suivi temps réel + alertes IA",
        "A/B testing autonome (bandit)",
        "Leads qualifiés avec scoring prédictif",
        "Liens courts & attribution omnicanale",
        "Tarification dynamique & anti-fraude"
    ]
    cta = "Essayer gratuitement"
    ad_primary = f"{data.product} automatise vos campagnes. Moins d’outils, plus de conversions."
    return {
        "headline": headline,
        "subheadline": sub,
        "bullets": bullets,
        "cta": cta,
        "ads": {
            "linkedin": {"primary": ad_primary, "cta": "Demander une démo"},
            "facebook": {"primary": ad_primary, "cta": "Commencer maintenant"}
        }
    }

@app.post("/pricing/suggest")
def pricing_suggest(p: PricingIn):
    # Ajustement simple par région (PPP fictif)
    factors = {
        "US": 1.0, "CA": 0.95, "FR": 0.9, "DE": 0.95, "UK": 1.05,
        "CM": 0.7, "CI": 0.7, "SN": 0.7, "NG": 0.65, "IN": 0.6
    }
    factor = factors.get((p.country or "US").upper(), 0.9)
    monthly = round(p.base_monthly * factor, 2)
    annual = round(monthly * 10, 2)  # 2 mois offerts
    return {"currency": p.currency, "country": p.country, "monthly": monthly, "annual": annual, "factor": factor}
