const express = require("express");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");
const { prisma } = require("../lib/prisma");
const { auth } = require("../middlewares/auth");

const router = express.Router();
const mode = () => (process.env.BILLING_MODE || "LOCAL").toUpperCase();
const publicUrl = () => process.env.PUBLIC_URL || "http://localhost:8080";

router.get("/plan", auth(true), async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.sub } });
  res.json({ plan: u.plan, mode: mode() });
});

router.post("/subscribe", auth(true), async (req, res) => {
  if (mode() !== "LOCAL") return res.status(400).json({ error: "use_checkout" });
  const u = await prisma.user.update({ where: { id: req.user.sub }, data: { plan: "pro" } });
  res.json({ ok: true, plan: u.plan });
});

router.post("/checkout", auth(true), async (req, res) => {
  const provider = (req.body?.provider || mode()).toUpperCase();
  const success = `${publicUrl()}/billing/success`;
  const cancel  = `${publicUrl()}/billing/cancel`;

  if (provider === "LOCAL") {
    return res.json({ provider, url: `${publicUrl()}/#/billing?status=success&session=local_${Date.now()}` });
  }
  if (provider === "STRIPE") {
    const key = process.env.STRIPE_SECRET_KEY;
    const price = process.env.STRIPE_PRICE_PRO;
    if (!key || !price) return res.status(400).json({ error: "missing_stripe_keys" });
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: success,
      cancel_url: cancel
    });
    return res.json({ provider, url: session.url });
  }
  if (provider === "PAYPAL") {
    const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !secret) return res.status(400).json({ error: "missing_paypal_keys" });
    const Environment = env === "live" ? paypal.core.LiveEnvironment : paypal.core.SandboxEnvironment;
    const client = new paypal.core.PayPalHttpClient(new Environment(clientId, secret));
    const req = new paypal.orders.OrdersCreateRequest();
    req.headers["prefer"] = "return=representation";
    req.requestBody({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: "10.00" }, description: "Nexora Pro" }],
      application_context: { return_url: success, cancel_url: cancel }
    });
    const order = await client.execute(req);
    const approve = order.result.links.find(l => l.rel === "approve")?.href;
    return res.json({ provider, url: approve || cancel });
  }
  if (provider === "CINETPAY") {
    const apiKey = process.env.CINETPAY_API_KEY;
    const siteId = process.env.CINETPAY_SITE_ID;
    if (!apiKey || !siteId) return res.status(400).json({ error: "missing_cinetpay_keys" });
    return res.json({ provider, url: `${success}?provider=cinetpay` }); // simplifié
  }
  res.status(400).json({ error: "unsupported_provider" });
});

module.exports = router;
