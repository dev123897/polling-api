const router = require('express').Router()
const wrap = require('../tools/wrap')
const db = require('../tools/db')

// possible statuses: 'pending' 'complete' 'canceled'

function randomHash(max) {
  const rand = max => Math.floor(Math.random() * max)
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let length = Math.random() * (max - 5) + 5 // at least 5 characters long
  let str = ''

  while(length--) str+= chars.at(rand(36))

  return str
}

const oneWeek = 604800000

// Prune expired orders weekly
setInterval(() => {
  console.log('deleting expired orders')
  db.query('DELETE FROM vts.polling WHERE expiration < NOW()')
}, oneWeek)

// Create ordered resource
function create(freightId, freightCompanyId) {
  console.log('creating resource')
  db.query('SELECT freightId, expiration, status FROM vts.polling WHERE freightId = ?', [freightId])
    .then(([col, ]) => {
      if (col.freightId === freightId && Date.now() < Date.parse(col.expiration) && col.status !== 'canceled') // if order has not expired and has not been canceled
        db.query('DELETE FROM orders WHERE freightId = ?', [freightId])
        db.query('INSERT INTO freight (id, received, sent, freightCompanyId, warehouseCode) VALUE (?,0,0,?,"+1")', [parseInt(freightId), parseInt(freightCompanyId)])
          .then(() => db.query('UPDATE vts.polling SET status = "complete" WHERE freightId = ?', [freightId]) )
          .catch(console.error)
    })
}

async function resourceExists (freightId) {
  const dbRes = await db.query('SELECT TRUE FROM vts.freight WHERE id = ?', [parseInt(freightId)])
  return dbRes.length
}

async function pollExists(req, res, next) {
  const poll = await db.query('SELECT freightId, expiration, status FROM vts.polling WHERE id = ?', [req.params.id])

  if (!poll.length) return res.status(404).json({ message: 'no such order' })

  req.poll = poll[0]

  next()
}

// Place order
router.post('/order', wrap(async (req, res, ext) => {
  console.log('placing order')
  if (!req.body.freightId || !req.body.freightCompanyId) return res.status(400).json({ message: 'missing parameter' })

  if (await resourceExists(req.body.freightId)) return res.sendStatus(409) // Do not process request if resource already taken

  const id = randomHash(5)
  const { insertId } = await db.query(
    'INSERT INTO polling (id, status, expiration, freightId, freightCompanyId) VALUE (?, "pending", DATE_ADD(NOW(), INTERVAL 1 WEEK), ?, ?)',
    [id, req.body.freightId, req.body.freightCompanyId] // 256 max value for hash in table
  )

  setTimeout(create, 120000, req.body.freightId, req.body.freightCompanyId) // 2min

  res.location('/v1/order/poll/' + id)
  res.sendStatus(202)
}))

// Poll for current status of order
router.get('/order/poll/:id', wrap(pollExists), wrap(async (req, res, ext) => {
  console.log('polling...')
  if (req.poll.status !== 'complete') {
    const json = { status: req.poll.status }

    if (req.poll.status === 'pending') json.link = { rel: 'cancel', method: 'delete', href: '/v1/order/cancel/' + req.params.id }

    res.status(200).json(json)
  }
  else {
    res.location('/v1/order/result/' + req.params.id)
    res.sendStatus(303)
  }
}))

// Cancel order
router.delete('/order/cancel/:id', wrap(pollExists), wrap(async (req, res, ext) => {
  await db.query('UPDATE vts.polling SET status = "canceled" WHERE id = ?', [req.params.id])

  res.sendStatus(204)
}))

// View fulfilled order
router.get('/order/result/:id', wrap(pollExists), wrap(async (req, res, ext) => {
  console.log('order complete')
  if ( req.poll.status === 'complete' && !(await resourceExists(req.poll.freightId)) )
    return res.status(500).json({ message: 'Error: completed order is missing' })

  res.status(200).json({
    status: req.poll.status,
    message: 'order fulfilled'
  })
}))

module.exports = router
