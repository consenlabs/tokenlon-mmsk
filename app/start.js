require('dotenv').config()
require('../lib').startMMSK(require('./mmConfig'))
console.log(`Worker ${process.pid} started`)
