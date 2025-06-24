const pg = require('pg')

module.exports = {
  getClient: () => {
    const client = new pg.Client()
    client.connect()
    return client
  },
}
