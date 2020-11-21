require('dotenv').config()
const mmConf = require('./mmConfig')
const mmsk = require('../lib')
const AMMQuoter = require('./amm_quoter.js')

// const cluster = require('cluster')
// const numCPUs = require('os').cpus().length
// const parallels = numCPUs > 8 ? 8 : numCPUs
const isAMMQuoter = process.env.AMM_QUOTER
// if (cluster.isMaster) {
//   console.log(`Master ${process.pid} is running`);

//   // Fork workers.
//   for (let i = 0; i < parallels; i++) {
//     cluster.fork()
//   }

//   cluster.on('exit', (worker, code, signal) => {
//     console.log(`worker ${worker.process.pid} died`)
//   })
// } else {

let config = { ...mmConf }
if (isAMMQuoter) {
  config['EXTERNAL_QUOTER'] = new AMMQuoter(config.PROVIDER_URL, config.AMMWRAPPER_CONTRACT_ADDRESS)
}

mmsk.startMMSK(mmConf)
console.log(`Worker ${process.pid} started`)
// }
