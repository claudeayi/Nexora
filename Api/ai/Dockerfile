# ai/Dockerfile
FROM python:3.11-slim

# --- Runtime env & performance ---
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UVICORN_HOST=0.0.0.0 \
    UVICORN_PORT=8000 \
    UVICORN_WORKERS=2 \
    UVICORN_LOG_LEVEL=info

WORKDIR /app

# --- Dépendances Python ---
# (optionnel) upgrade outils build pour wheels récents
RUN python -m pip install --upgrade pip setuptools wheel

# Installer les deps d'abord pour profiter du cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Code application ---
COPY app.py .

# --- Sécurité: utilisateur non-root ---
RUN addgroup --system app && adduser --system --ingroup app app \
 && chown -R app:app /app
USER app

EXPOSE 8000

# --- Healthcheck (sans curl) ---
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python - <<'PY' || exit 1
import urllib.request, sys
try:
    with urllib.request.urlopen("http://127.0.0.1:8000/healthz", timeout=2) as r:
        sys.exit(0 if r.status==200 else 1)
except Exception:
    sys.exit(1)
PY

# --- Démarrage Uvicorn ---
CMD ["uvicorn", "app:app", \
     "--host", "${UVICORN_HOST}", \
     "--port", "${UVICORN_PORT}", \
     "--workers", "${UVICORN_WORKERS}", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--log-level", "${UVICORN_LOG_LEVEL}", \
     "--timeout-keep-alive", "5"]
