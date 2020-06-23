const startMMSK = require("../lib").startMMSK
const loadEnvConfig = require("dotenv").config

async function main() {
  loadEnvConfig()
  startMMSK({
    EXCHANGE_URL: process.env.EXCHANGE_URL,
    WEBSOCKET_URL: process.env.WEBSOCKET_URL,
    PROVIDER_URL: process.env.PROVIDER_URL,
    USE_KEYSTORE: false,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,
    MMSK_SERVER_PORT: 8080,
    USE_ZERORPC: false,
    HTTP_SERVER_ENDPOINT: process.env.HTTP_SERVER_ENDPOINT,
    NODE_ENV: 'DEVELOPMENT',
  })
}

const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const parallels = numCPUs > 8 ? 8 : numCPUs

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < parallels; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`)
  })
} else {
  main().catch(console.error)

  console.log(`Worker ${process.pid} started`)
}
