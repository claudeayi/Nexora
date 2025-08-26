const { EventEmitter } = require('events')
const bus = new EventEmitter()
bus.setMaxListeners(0)

const buffers = new Map() // tenantId -> [{title,message,time,seen:false}, ...]
const MAX_ITEMS = 100

function push(tenantId, note) {
  const arr = buffers.get(tenantId) || []
  const item = { time: new Date().toISOString(), ...note }
  arr.unshift(item)
  buffers.set(tenantId, arr.slice(0, MAX_ITEMS))
  bus.emit(`notify:${tenantId}`, item)
}

function list(tenantId) {
  return buffers.get(tenantId) || []
}

function subscribe(tenantId, fn) {
  const ch = `notify:${tenantId}`
  bus.on(ch, fn)
  return () => bus.off(ch, fn)
}

module.exports = { push, list, subscribe }
