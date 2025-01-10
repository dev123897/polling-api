const mariadb = require('mariadb')

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  connectionLimit: 5 // Maximum number of connection in pool
})

let conn

async function connect() {
  try {
    console.log('Connecting to MariaDB...')

    conn = await pool.getConnection()

    console.log('Connection established')
  } catch (e) {
    console.error('ERROR failed to connect to MariaDB:', e)

    throw e
  }
}

async function query(sql, params) {
  console.log('[INFO] -- SQL COMMAND --\n' + sql, `[${params?.join() ?? ''}]\n`)

  const rows = params instanceof Array
    ? await conn.query(sql, params)
    : await conn.query(sql)

  return rows
}

function disconnect() {
  conn.release()
  console.log('\nDisconnected from MariaDB')
}

process.on('SIGINT', async function() {
  disconnect()
  process.exit()
})

module.exports = {
  connect,
  query
}
