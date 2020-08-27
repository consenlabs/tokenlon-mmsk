require('dotenv').config()
module.exports = {
  // Tokenlon server address
  EXCHANGE_URL: process.env.EXCHANGE_URL,
  PROVIDER_URL: process.env.PROVIDER_URL,

  // Wallet
  WALLET_ADDRESS: process.env.WALLET_ADDRESS,
  USE_KEYSTORE: !process.env.USE_KEYSTORE || JSON.parse(process.env.USE_KEYSTORE),
  WALLET_KEYSTORE: {},
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,

  // MM backend config
  HTTP_SERVER_ENDPOINT: process.env.HTTP_SERVER_ENDPOINT,

  // Server config
  CHAIN_ID: process.env.CHAIN_ID || 42,
  MMSK_SERVER_PORT: process.env.MMSK_SERVER_PORT || 80,
  SENTRY_DSN: '',
  NODE_ENV: 'PRODUCTION',
  QUOTER: null,
}
