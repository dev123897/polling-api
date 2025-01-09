const {basename,extname,join} = require('path')

const thisFile = basename(__filename)

module.exports = require('fs')
  .readdirSync(__dirname)
  .filter(file => file !== thisFile && extname(file) !== '.swp')
  .map(file => require(join(__dirname, file)))
