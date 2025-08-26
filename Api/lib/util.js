// api/src/lib/util.js
/* eslint-disable no-control-regex */
const crypto = require("crypto");

/* ==========================
 *  ⚙️ Configuration (ENV)
 * ========================== */

const cfg = {
  EMAIL_WEIGHT: Number(process.env.SCORE_EMAIL_WEIGHT || 20),
  DOMAIN_CORP_WEIGHT: Number(process.env.SCORE_DOMAIN_CORP_WEIGHT || 15),
  DOMAIN_FREE_WEIGHT: Number(process.env.SCORE_DOMAIN_FREE_WEIGHT || 5),
  PHONE_MIN_DIGITS: Number(process.env.SCORE_PHONE_MIN_DIGITS || 8),
  PHONE_WEIGHT: Number(process.env.SCORE_PHONE_WEIGHT || 15),
  UTM_SOURCE_WEIGHT: Number(process.env.SCORE_UTM_SOURCE_WEIGHT || 10),
  UTM_CAMPAIGN_WEIGHT: Number(process.env.SCORE_UTM_CAMPAIGN_WEIGHT || 10),
  UTM_INTENT_B2B_WEIGHT: Number(process.env.SCORE_UTM_INTENT_B2B_WEIGHT || 10),
  MAX_SCORE: Number(process.env.SCORE_MAX || 100),
};

const FREE_MAIL_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "outlook.com",
  "live.com", "icloud.com", "aol.com", "gmx.com", "proton.me",
]);

// Liste courte anti-spam/jetables (tu peux l’étendre via env plus tard)
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "yopmail.com",
]);

/* ==========================
 *  🧰 Helpers utilitaires
 * ========================== */

/** Trim “safe” sur string nullable */
function s(x) {
  return (x == null ? "" : String(x)).trim();
}

/** Normalise un numéro : garde uniquement les chiffres */
function normalizePhone(phone) {
  return s(phone).replace(/\D/g, "");
}

/** Extrait le domaine d’un email, en minuscule */
function parseEmailDomain(email) {
  const e = s(email).toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return "";
  return e.slice(at + 1);
}

/** Détermine si un domaine est “gratuit” (gmail/outlook/…) */
function isFreeMailDomain(domain) {
  return FREE_MAIL_PROVIDERS.has(s(domain).toLowerCase());
}

/** Détermine si un domaine est jetable */
function isDisposableDomain(domain) {
  return DISPOSABLE_DOMAINS.has(s(domain).toLowerCase());
}

/** Validation email simple (rapide) */
function isLikelyEmail(email) {
  const E = s(email);
  if (E.length < 5 || E.length > 254) return false;
  // RFC-compliant est plus complexe; ici un test raisonnable
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(E);
}

/** Clamp numérique dans [min,max] */
function clamp(n, min, max) {
  n = Number(n) || 0;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** JSON “stable” (tri des clés) pour des hash reproductibles */
function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",");
  return `{${body}}`;
}

/* ==========================
 *  🧮 Scoring des leads
 * ========================== */

/**
 * Calcule un score lead (0..MAX_SCORE) en fonction de:
 * - email présent + type de domaine (gratuit vs. corporate)
 * - présence d’un téléphone (min digits)
 * - utmSource / utmCampaign
 * - intention B2B (regex "pro|enterprise|b2b")
 *
 * Les poids sont configurables via .env (voir cfg ci-dessus).
 */
function computeLeadScore({ email = "", phone = "", utmSource = "", utmCampaign = "" } = {}) {
  let score = 0;

  // Email
  if (isLikelyEmail(email)) {
    score += cfg.EMAIL_WEIGHT;

    const domain = parseEmailDomain(email);
    if (domain) {
      if (isDisposableDomain(domain)) {
        // Domaine jetable -> pénalité : on retire la partie domaine-corp
        score -= Math.min(cfg.DOMAIN_CORP_WEIGHT, 10);
      } else if (isFreeMailDomain(domain)) {
        score += cfg.DOMAIN_FREE_WEIGHT;
      } else {
        score += cfg.DOMAIN_CORP_WEIGHT; // domaine “corporate” => bon signe B2B
      }
    }
  }

  // Téléphone
  if (normalizePhone(phone).length >= cfg.PHONE_MIN_DIGITS) {
    score += cfg.PHONE_WEIGHT;
  }

  // UTM
  if (s(utmSource)) score += cfg.UTM_SOURCE_WEIGHT;
  if (s(utmCampaign)) score += cfg.UTM_CAMPAIGN_WEIGHT;

  // Intention B2B
  if (/pro|enterprise|b2b/i.test(s(utmCampaign))) {
    score += cfg.UTM_INTENT_B2B_WEIGHT;
  }

  return clamp(score, 0, cfg.MAX_SCORE);
}

/**
 * Transforme les infos lead en “features” pour l’IA (microservice /predict/lead)
 */
function toLeadAiFeatures({ email = "", phone = "", utmSource = "", utmCampaign = "", engagement = 0 }) {
  const domain = parseEmailDomain(email);
  const email_domain_corporate = !!(domain && !isFreeMailDomain(domain) && !isDisposableDomain(domain));
  const has_phone = normalizePhone(phone).length >= cfg.PHONE_MIN_DIGITS;
  const utm_source_known = !!s(utmSource);
  const utm_campaign_pro = /pro|enterprise|b2b/i.test(s(utmCampaign));
  const engagement_score = clamp(engagement, 0, 1);
  return { email_domain_corporate, has_phone, utm_source_known, utm_campaign_pro, engagement_score };
}

/* ==========================
 *  🔐 Hash & Ledger
 * ========================== */

function sha256(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Calcule le hash d’un “bloc” de preuve
 * On utilise un stringify stable pour assurer un hash reproductible
 */
function ledgerHash(prevHash, data) {
  const payload = stableStringify({ prevHash: prevHash || null, data });
  return sha256(payload);
}

/**
 * Valide une chaîne de ProofLedger en mémoire.
 * @param {Array<{prevHash: string|null, data: any, hash: string}>} records ordonnés chronologiquement
 * @returns {boolean}
 */
function validateLedgerChain(records = []) {
  let lastHash = null;
  for (const r of records) {
    const expected = ledgerHash(lastHash, r.data);
    if (expected !== r.hash) return false;
    lastHash = r.hash;
  }
  return true;
}

/* ==========================
 *  📦 Exports
 * ========================== */

module.exports = {
  // scoring
  computeLeadScore,
  toLeadAiFeatures,

  // email/phone helpers
  parseEmailDomain,
  normalizePhone,
  isFreeMailDomain,
  isDisposableDomain,
  isLikelyEmail,

  // math / json
  clamp,
  stableStringify,

  // ledger / crypto
  sha256,
  ledgerHash,
  validateLedgerChain,
};
