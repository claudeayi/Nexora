const router = require('express').Router()
const { prisma } = require('../lib/prisma')
const { auth } = require('../middlewares/auth')
const { resolveTenant } = require('../middlewares/tenant')

router.use(auth(false), resolveTenant)

function seriesFrom(rows, key = 'createdAt', days = 7) {
  const now = new Date()
  const map = new Map()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(+now); d.setDate(now.getDate() - i)
    map.set(d.toISOString().slice(0, 10), 0)
  }
  for (const r of rows) {
    const label = new Date(r[key]).toISOString().slice(0, 10)
    if (map.has(label)) map.set(label, (map.get(label) || 0) + 1)
  }
  return Array.from(map, ([date, count]) => ({ date, count }))
}

router.get('/overview', async (req, res) => {
  const tenantId = req.tenant.id
  const [leadCount, clickCount, eventCount] = await Promise.all([
    prisma.lead.count({ where: { tenantId } }),
    prisma.click.count({ where: { tenantId } }),
    prisma.event.count({ where: { tenantId } })
  ])
  const since = new Date(); since.setDate(since.getDate() - 7)
  const [leads, clicks] = await Promise.all([
    prisma.lead.findMany({ where: { tenantId, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.click.findMany({ where: { tenantId, createdAt: { gte: since } }, select: { createdAt: true } })
  ])
  res.json({
    leadCount, clickCount, eventCount,
    seriesLeads: seriesFrom(leads),
    seriesClicks: seriesFrom(clicks)
  })
})

module.exports = router
