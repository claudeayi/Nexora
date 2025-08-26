// api/middlewares/auth.js
const jwt = require("jsonwebtoken");

/**
 * Config JWT (personnalisable via .env)
 * - JWT_SECRET: clé de signature (OBLIGATOIRE en prod)
 * - JWT_ISSUER, JWT_AUDIENCE: contrôle d’émetteur / audience (optionnels)
 * - JWT_ALG: algorithme (par défaut HS256)
 * - JWT_MAX_AGE: ex "7d" / "1h" (optionnel; utilisé à l’émission)
 * - JWT_CLOCK_TOLERANCE: tolérance en secondes sur l’horloge (défaut 5s)
 */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_VERIFY_OPTS = {
  algorithms: [process.env.JWT_ALG || "HS256"],
  issuer: process.env.JWT_ISSUER || undefined,
  audience: process.env.JWT_AUDIENCE || undefined,
  clockTolerance: Number(process.env.JWT_CLOCK_TOLERANCE || 5),
};

/**
 * Récupère le token depuis:
 * - Authorization: Bearer xxx
 * - Cookie "token" (si tu poses le token en cookie httpOnly)
 * - En-têtes x-access-token / x-auth-token
 * - Query ?token=xxx (utile pour WebSocket/pixel; évite-le en prod)
 */
function extractToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();

  if (req.cookies && req.cookies.token) return req.cookies.token;

  const alt =
    req.headers["x-access-token"] ||
    req.headers["x-auth-token"] ||
    req.query?.token;
  if (typeof alt === "string" && alt.length > 0) return alt.trim();

  return null;
}

/**
 * Vérifie et décode un JWT.
 * Retourne { payload, error } sans throw pour simplifier l’usage.
 */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTS);
    return { payload, error: null };
  } catch (err) {
    return { payload: null, error: err };
  }
}

/**
 * Émet un access token signé.
 * @param {object} claims - champs custom (id, email, role, plan, tenantId, tenantKey, scopes[])
 * @param {object} opts - { expiresIn?: "7d", subject?: string }
 */
function signAccessToken(claims = {}, opts = {}) {
  const expiresIn = opts.expiresIn || process.env.JWT_MAX_AGE || "7d";
  const payload = {
    // champs standard utiles
    sub: claims.sub || claims.id,
    email: claims.email,
    role: claims.role || "user",
    plan: claims.plan || "free",
    tenantId: claims.tenantId,
    tenantKey: claims.tenantKey,
    scopes: Array.isArray(claims.scopes) ? claims.scopes : [],
    // champs additionnels
    ...claims,
  };

  const signOpts = {
    algorithm: (process.env.JWT_ALG || "HS256"),
    issuer: process.env.JWT_ISSUER || undefined,
    audience: process.env.JWT_AUDIENCE || undefined,
    expiresIn,
    subject: opts.subject || payload.sub,
  };

  return jwt.sign(payload, JWT_SECRET, signOpts);
}

/**
 * Middleware d’authentification.
 * - required=true => 401 si pas de token / invalide
 * - required=false => continue sans req.user
 * - Ajoute req.user (payload), req.tenantKey et req.tenantId
 */
function auth(required = true) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      if (required) return res.status(401).json({ error: "missing_token" });
      return next();
    }

    const { payload, error } = verifyToken(token);
    if (error) {
      if (required) {
        const code =
          error.name === "TokenExpiredError"
            ? "token_expired"
            : "invalid_token";
        return res.status(401).json({ error: code });
      }
      return next();
    }

    req.user = payload || {};
    // Multi-tenant: laisse un fallback via header x-tenant
    req.tenantId = payload?.tenantId || req.headers["x-tenant-id"] || undefined;
    req.tenantKey =
      (payload?.tenantKey || req.headers["x-tenant"] || "").toString() ||
      undefined;

    // Expose aussi dans res.locals pour les handlers/templating
    res.locals.user = req.user;
    res.locals.tenantId = req.tenantId;
    res.locals.tenantKey = req.tenantKey;

    return next();
  };
}

/**
 * Vérifie que l’utilisateur possède l’un des rôles attendus.
 * Exemple: app.get('/admin', auth(true), requireRole('admin'), handler)
 */
function requireRole(...allowedRoles) {
  const roles = new Set(
    allowedRoles.flat().map((r) => String(r || "").toLowerCase())
  );
  return (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();
    if (!role || !roles.has(role)) {
      return res.status(403).json({ error: "forbidden_role" });
    }
    next();
  };
}

/**
 * Vérifie que l’utilisateur a un plan autorisé (ex: 'pro', 'enterprise').
 */
function requirePlan(...allowedPlans) {
  const plans = new Set(
    allowedPlans.flat().map((p) => String(p || "").toLowerCase())
  );
  return (req, res, next) => {
    const plan = String(req.user?.plan || "").toLowerCase();
    if (!plan || !plans.has(plan)) {
      return res.status(402).json({ error: "payment_required_or_plan" });
    }
    next();
  };
}

/**
 * Vérifie la présence d’un ou plusieurs scopes dans le token.
 * Ex: requireScope('leads:write') ou requireScope(['ab:admin','flags:write'])
 */
function requireScope(scopes) {
  const needed = new Set(
    (Array.isArray(scopes) ? scopes : [scopes]).map((s) =>
      String(s || "").toLowerCase()
    )
  );
  return (req, res, next) => {
    const granted = new Set(
      (req.user?.scopes || []).map((s) => String(s || "").toLowerCase())
    );
    for (const s of needed) {
      if (!granted.has(s)) {
        return res.status(403).json({ error: "forbidden_scope", scope: s });
      }
    }
    next();
  };
}

module.exports = {
  auth,                 // middleware principal (required=true/false)
  requireRole,          // guard par rôle
  requirePlan,          // guard par plan (pro/enterprise…)
  requireScope,         // guard par scopes (RBAC/ABAC fin)
  signAccessToken,      // helper pour émettre les tokens dans /auth
  verifyToken,          // helper si besoin dans d’autres modules
  extractToken,         // utilitaire d’extraction
};
