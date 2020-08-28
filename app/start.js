require('dotenv').config()

const mmConf = require('./mmConfig')
const mmsk = require('../lib')

const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const parallels = numCPUs > 8 ? 8 : numCPUs

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`)

  // Fork workers.
  for (let i = 0; i < parallels; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`)
  })
} else {
  mmsk.startMMSK(mmConf)
  console.log(`Worker ${process.pid} started`)
}
