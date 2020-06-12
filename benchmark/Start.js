//import { startMMSK } from '../src'
//import { config as loadEnvConfig } from 'dotenv'

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

main().catch(console.error)
