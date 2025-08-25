const crypto = require("crypto");

function computeLeadScore({ email="", phone="", utmSource="", utmCampaign="" }) {
  let s = 0;
  if (email.includes("@")) s += 20;
  const domain = (email.split("@")[1] || "");
  if (/(gmail|yahoo|outlook)\./i.test(domain)) s += 5; else if (domain) s += 15;
  if (phone.replace(/\D/g,"").length >= 8) s += 15;
  if (utmSource) s += 10;
  if (utmCampaign) s += 10;
  if (/pro|enterprise|b2b/i.test(utmCampaign)) s += 10;
  return Math.max(0, Math.min(100, s));
}

function sha256(input){ return crypto.createHash("sha256").update(input).digest("hex"); }
function ledgerHash(prevHash, data){ return sha256(JSON.stringify({ prevHash, data })); }

module.exports = { computeLeadScore, ledgerHash };
