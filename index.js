const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

require('./tools/config')
const db = require('./tools/db')

; (async function() { await db.connect() })()

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())

// Require json for content type
app.use((req, res, next) => {
  if (req.accepts('json')) next()
  else res.status(406)
})

app.use('/v1', require('./routes'))

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
    res.status(500).send('An error occured.\n')
})

app.listen(process.env.PORT, console.log(`Ordering API listening on port ${process.env.PORT}`))
