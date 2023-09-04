const types = require('../lib/signer/types')
const dotenv = require('dotenv')
dotenv.config()

module.exports = {
  // Tokenlon server address
  EXCHANGE_URL: process.env.EXCHANGE_URL,
  PROVIDER_URL: process.env.PROVIDER_URL,
  PERMIT_TYPE: types.PermitType.APPROVE_RFQV2,

  // Signing
  /**
   * If you wanna sign orders in your own service instead of the mmsk,
   * please set the SIGNING_URL to your service endpoint.
   * the mmsk would post every unsigned orders to your service.
   * Remember to set the WALLET_ADDRESS as well.
   */
  SIGNING_URL: process.env.SIGNING_URL,
  WALLET_ADDRESS: process.env.WALLET_ADDRESS,
  WALLET_TYPE: types.WalletType.MMP_VERSION_4,
  USE_KEYSTORE: false,
  WALLET_KEYSTORE: {},
  /**
   * If you set the SIGNING_URL and WALLET_ADDRESS, it's unnecessary to set the WALLET_PRIVATE_KEY.
   * It would forward evey unsigned order to SIGNING_URL instead of signing orders with WALLET_PRIVATE_KEY
   */
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,

  // AMM
  AMMWRAPPER_CONTRACT_ADDRESS: process.env.AMMWRAPPER_CONTRACT_ADDRESS,

  // MM backend config
  HTTP_SERVER_ENDPOINT: process.env.HTTP_SERVER_ENDPOINT,
  // ZERORPC_SERVER_ENDPOINT: process.env.ZERORPC_SERVER_ENDPOINT,

  // Server config
  CHAIN_ID: process.env.CHAIN_ID || 5,
  MMSK_SERVER_PORT: process.env.MMSK_SERVER_PORT || 80,
  SENTRY_DSN: '',
  NODE_ENV: 'PRODUCTION',
  QUOTER: null,
}
