const router = require('express').Router()
const wrap = require('../tools/wrap')
const db = require('../tools/db')

router.get('/asdf', wrap(async (req, res, ext) => {
  // await db.query('', [])
  res.sendStatus(204)
}))

module.exports = router
