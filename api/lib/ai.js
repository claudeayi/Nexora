const axios = require('axios')
const AI_BASE = process.env.AI_BASE_URL || 'http://localhost:8000'

async function genCopy({ product, audience, goal }) {
  try {
    const { data } = await axios.post(`${AI_BASE}/generate/copy`, { product, audience, goal })
    return data
  } catch (e) {
    // Fallback local
    return {
      headline: `${product} : votre copilote ${audience}`,
      subheadline: `Objectif : ${goal}. Démarrez en 2 minutes.`,
      bullets: [
        "Suivi temps réel + alertes IA",
        "A/B testing autonome (bandit)",
        "Leads qualifiés avec scoring prédictif",
        "Liens courts & attribution omnicanale",
        "Tarification dynamique & anti-fraude"
      ],
      cta: "Essayer gratuitement"
    }
  }
}

async function leadPredict(features) {
  try {
    const { data } = await axios.post(`${AI_BASE}/predict/lead`, features)
    return data
  } catch {
    // Heuristique simple si IA down
    const p = 0.4
    return { probability: p, score: Math.round(p * 100) }
  }
}

async function pricingSuggest({ country, currency, base }) {
  try {
    const url = `${AI_BASE}/pricing/suggest`
    const { data } = await axios.post(url, { country, currency, base_monthly: Number(base) || 19 })
    return data
  } catch {
    return { country, currency, monthly: Number(base) || 19, annual: (Number(base) || 19) * 10, factor: 1 }
  }
}

module.exports = { genCopy, leadPredict, pricingSuggest }
