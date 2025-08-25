const jwt = require("jsonwebtoken");

function auth(required = true){
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return required ? res.status(401).json({ error: "missing_token" }) : next();
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      return next();
    } catch {
      return required ? res.status(401).json({ error: "invalid_token" }) : next();
    }
  };
}

module.exports = { auth };
