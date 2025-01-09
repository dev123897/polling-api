const dotenv = require('dotenv')

// Load .env into process
const env = process.env.production
  ? dotenv.config()
  : dotenv.config({ path: ['.env.development'] })

if (env.error) throw env.error
