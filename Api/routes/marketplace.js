const router = require('express').Router()
const { prisma } = require('../lib/prisma')
const { auth } = require('../middlewares/auth')
const { resolveTenant } = require('../middlewares/tenant')
const { push } = require('../lib/notify')

router.use(auth(false), resolveTenant)

// GET /marketplace/installed
router.get('/installed', async (req, res) => {
  const items = await prisma.marketplaceInstall.findMany({
    where: { tenantId: req.tenant.id },
    select: { appId: true }
  })
  res.json({ items: items.map(i => i.appId) })
})

// POST /marketplace/install { id }
router.post('/install', async (req, res) => {
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'missing_id' })
  await prisma.marketplaceInstall.upsert({
    where: { tenantId_appId: { tenantId: req.tenant.id, appId: id } },
    create: { tenantId: req.tenant.id, appId: id },
    update: {}
  })
  push(req.tenant.id, { title: 'Marketplace', message: `Extension installée: ${id}` })
  res.json({ ok: true })
})

// POST /marketplace/uninstall { id }
router.post('/uninstall', async (req, res) => {
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'missing_id' })
  await prisma.marketplaceInstall.deleteMany({ where: { tenantId: req.tenant.id, appId: id } })
  push(req.tenant.id, { title: 'Marketplace', message: `Extension désinstallée: ${id}` })
  res.json({ ok: true })
})

module.exports = router
