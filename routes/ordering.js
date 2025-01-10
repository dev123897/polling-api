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
function create(did, carrierId) {
  db.query('SELECT did, expiration, status FROM vts.polling WHERE did = ?', [did])
    .then(([col, ]) => {
      if (col.did === did && Date.now() < Date.parse(col.expiration) && col.status !== 'canceled') // if order has not expired and has not been canceled
        db.query('INSERT INTO vts.dids (did, e911Enabled, enabled, carrierId, countryCode) VALUE (?,0,0,?,"+1")', [parseInt(did), parseInt(carrierId)])
          .then(() => db.query('UPDATE vts.polling SET status = "complete" WHERE did = ?', [did]) )
          .catch(console.error)
    })
}

async function resourceExists (did) {
  const dbRes = await db.query('SELECT TRUE FROM vts.dids WHERE did = ?', [parseInt(did)])
  return dbRes.length
}

async function pollExists(req, res, next) {
  const poll = await db.query('SELECT did, expiration, status FROM vts.polling WHERE id = ?', [req.params.id])

  if (!poll.length) return res.status(404).json({ message: 'no such order' })

  req.poll = poll[0]

  next()
}

// Place order
router.post('/order', wrap(async (req, res, ext) => {
  if (!req.body?.did || !req.body?.carrierId) return res.sendStatus(400)

  if (await resourceExists(req.body.did)) return res.sendStatus(409) // Do not process request if resource already taken

  const id = randomHash(5)
  const { insertId } = await db.query(
    'INSERT INTO vts.polling (id, status, expiration, did, carrierId) VALUE (?, "pending", DATE_ADD(NOW(), INTERVAL 1 WEEK), ?, ?)',
    [id, req.body.did, req.body.carrierId]
  )

  setTimeout(create, 250000, req.body.did, req.body.carrierId)

  res.location('/v1/order/poll/' + id)
  res.sendStatus(202)
}))

// Poll for current status of order
router.get('/order/poll/:id', wrap(pollExists), wrap(async (req, res, ext) => {
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
  if ( req.poll.status === 'complete' && !(await resourceExists(req.poll.did)) )
    return res.status(500).json({ message: 'Error: completed order is missing' })

  res.status(200).json({ message: 'order fulfilled' })
}))

module.exports = router
