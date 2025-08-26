# ai/app.py
from __future__ import annotations

import os
import math
import numpy as np
from typing import List, Optional, Literal, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

try:
    # scikit-learn est optionnel (présent dans requirements.txt)
    from sklearn.ensemble import IsolationForest  # type: ignore
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False

APP_NAME = os.getenv("AI_APP_NAME", "Nexora AI Service")
APP_VERSION = os.getenv("AI_APP_VERSION", "1.0.0")
CORS_ORIGINS = [o.strip() for o in os.getenv("AI_CORS_ORIGINS", "*").split(",")]

app = FastAPI(title=APP_NAME, version=APP_VERSION)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in CORS_ORIGINS else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================
#         Models
# =======================

class LeadFeatures(BaseModel):
    email_domain_corporate: bool = False
    has_phone: bool = False
    utm_source_known: bool = False
    utm_campaign_pro: bool = False
    engagement_score: float = Field(0.0, ge=0.0, le=1.0, description="Normalized engagement in [0,1]")

class VariantsStats(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    views: int = Field(0, ge=0)
    conversions: int = Field(0, ge=0)

    @field_validator("conversions")
    @classmethod
    def conversions_cannot_exceed_views(cls, v, info):
        views = info.data.get("views", 0)
        if v > views:
            raise ValueError("conversions cannot exceed views")
        return v

class ABSelectIn(BaseModel):
    variants: List[VariantsStats] = Field(..., min_length=1)

class TimeSeries(BaseModel):
    values: List[float] = Field(..., min_length=5)
    method: Literal["zscore", "iforest"] = "zscore"
    z_thresh: float = Field(2.5, gt=0.0, description="Z-score absolute threshold when method=zscore")
    contamination: float = Field(0.1, gt=0.0, lt=0.5, description="IForest contamination when method=iforest")
    random_state: Optional[int] = Field(None, description="IForest random_state for reproducibility")

class GenCopyIn(BaseModel):
    product: str = Field(..., min_length=2, max_length=80)
    audience: str = Field(..., min_length=2, max_length=80)
    goal: str = Field(..., min_length=2, max_length=160)

class PricingIn(BaseModel):
    currency: str = Field("USD", min_length=3, max_length=5)
    country: Optional[str] = Field(None, min_length=2, max_length=3)
    base_monthly: float = Field(19.0, gt=0.0)

# =======================
#      Health & Meta
# =======================

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/version")
def version():
    return {"name": APP_NAME, "version": APP_VERSION, "sklearn": SKLEARN_AVAILABLE}

# =======================
#     Lead Prediction
# =======================

@app.post("/predict/lead")
def predict_lead(f: LeadFeatures):
    """
    Petit modèle logistique heuristique (pas d'entraînement) avec transform sigmoïde.
    """
    w = np.array([1.2, 1.0, 0.6, 0.8, 1.6], dtype=float)
    x = np.array([
        1.0 if f.email_domain_corporate else 0.0,
        1.0 if f.has_phone else 0.0,
        1.0 if f.utm_source_known else 0.0,
        1.0 if f.utm_campaign_pro else 0.0,
        float(f.engagement_score),
    ], dtype=float)
    z = float(np.dot(w, x) - 2.0)  # biais
    p = 1.0 / (1.0 + math.exp(-z))
    score100 = round(p * 100, 2)
    return {"probability": p, "score": score100}

# =======================
#   A/B Variant Select
# =======================

@app.post("/ab/select")
def ab_select(req: ABSelectIn):
    """
    Thompson Sampling (Beta) pour sélectionner une variante.
    """
    best_name = None
    best_sample = -1.0
    for v in req.variants:
        a = 1 + max(0, v.conversions)
        b = 1 + max(0, v.views - v.conversions)
        sample = float(np.random.beta(a, b))
        if sample > best_sample:
            best_sample = sample
            best_name = v.name
    return {"variant": best_name, "sample": best_sample}

# =======================
#     Anomaly Detection
# =======================

def detect_anomalies_zscore(vals: np.ndarray, z_thresh: float) -> Tuple[List[int], float, float]:
    mean = float(vals.mean())
    std = float(vals.std() if vals.std() > 0 else 1.0)
    z = (vals - mean) / std
    idx = [int(i) for i, zz in enumerate(z) if abs(float(zz)) >= z_thresh]
    return idx, mean, std

def detect_anomalies_iforest(vals: np.ndarray, contamination: float, random_state: Optional[int]) -> List[int]:
    if not SKLEARN_AVAILABLE:
        raise HTTPException(status_code=400, detail="IsolationForest not available: scikit-learn missing")
    X = vals.reshape(-1, 1)
    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
        verbose=0,
    )
    model.fit(X)
    pred = model.predict(X)  # -1 = outlier, 1 = inlier
    return [int(i) for i, p in enumerate(pred) if int(p) == -1]

@app.post("/anomaly/events")
def anomaly_events(ts: TimeSeries):
    """
    Détection d'anomalies sur série 1D.
    - method=zscore : seuil absolu sur Z-score
    - method=iforest : Isolation Forest (scikit-learn)
    """
    vals = np.array(ts.values, dtype=float)
    if ts.method == "zscore":
        idx, mean, std = detect_anomalies_zscore(vals, ts.z_thresh)
        return {"method": "zscore", "anomalies": idx, "mean": mean, "std": std}
    else:
        # Isolation Forest
        idx = detect_anomalies_iforest(vals, ts.contamination, ts.random_state)
        return {"method": "iforest", "anomalies": idx}

# =======================
#    Copy Generation
# =======================

@app.post("/generate/copy")
def generate_copy(data: GenCopyIn):
    """
    Génération locale simple (sans LLM). Pour brancher un LLM, remplacer la logique ici.
    """
    product = data.product.strip()
    audience = data.audience.strip().lower()
    goal = data.goal.strip()

    headline = f"{product} : votre copilote {audience}"
    sub = f"Objectif : {goal}. Démarrez en 2 minutes, suivez et optimisez automatiquement."
    bullets = [
        "Suivi temps réel + alertes IA",
        "A/B testing autonome (bandit)",
        "Leads qualifiés avec scoring prédictif",
        "Liens courts & attribution omnicanale",
        "Tarification dynamique & anti-fraude",
    ]
    cta = "Essayer gratuitement"
    ad_primary = f"{product} automatise vos campagnes. Moins d’outils, plus de conversions."

    return {
        "headline": headline,
        "subheadline": sub,
        "bullets": bullets,
        "cta": cta,
        "ads": {
            "linkedin": {"primary": ad_primary, "cta": "Demander une démo"},
            "facebook": {"primary": ad_primary, "cta": "Commencer maintenant"},
        },
    }

# =======================
#     Pricing Suggest
# =======================

PPP_FACTORS = {
    "US": 1.0, "CA": 0.95, "FR": 0.90, "DE": 0.95, "UK": 1.05,
    "CM": 0.70, "CI": 0.70, "SN": 0.70, "NG": 0.65, "IN": 0.60,
}

@app.post("/pricing/suggest")
def pricing_suggest(p: PricingIn):
    """
    Ajustement simple par région (PPP fictif).
    """
    country = (p.country or "US").upper()
    factor = float(PPP_FACTORS.get(country, 0.90))
    monthly = round(float(p.base_monthly) * factor, 2)
    annual = round(monthly * 10, 2)  # ~2 mois offerts
    return {"currency": p.currency.upper(), "country": country, "monthly": monthly, "annual": annual, "factor": factor}

# =======================
#    Main (local run)
# =======================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=os.getenv("UVICORN_HOST", "0.0.0.0"),
        port=int(os.getenv("UVICORN_PORT", "8000")),
        reload=bool(os.getenv("UVICORN_RELOAD", "").lower() in ("1", "true", "yes")),
        workers=int(os.getenv("UVICORN_WORKERS", "1")),
        log_level=os.getenv("UVICORN_LOG_LEVEL", "info"),
    )
