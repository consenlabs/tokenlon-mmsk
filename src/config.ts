import * as readlineSync from 'readline-sync'
import { ConfigForStart } from './types'
import { Wallet } from 'ethers'

const config = {
  EXCHANGE_URL: null,
  PROVIDER_URL: null,

  WALLET_ADDRESS: null,
  WALLET_PRIVATE_KEY: null,
  USE_KEYSTORE: true,

  WALLET_KEYSTORE: null,
  MMSK_SERVER_PORT: null,

  HTTP_SERVER_ENDPOINT: null,

  NODE_ENV: 'DEVELOPMENT',
  SENTRY_DSN: null,
}

const setConfig = (conf: ConfigForStart) => {
  if (conf.USE_KEYSTORE) {
    const KEYSTORE_PASSWORD = readlineSync.question("Please input your keystore's password: ", {
      hideEchoBack: true,
    })
    const wallet = Wallet.fromEncryptedJsonSync(conf.WALLET_KEYSTORE, KEYSTORE_PASSWORD)
    conf.WALLET_PRIVATE_KEY = wallet.privateKey
  }
  return Object.assign(config, conf)
}

const getWallet = () => {
  return new Wallet(
    config.WALLET_PRIVATE_KEY.startsWith('0x')
      ? config.WALLET_PRIVATE_KEY
      : '0x' + config.WALLET_PRIVATE_KEY
  )
}

export { config, setConfig, getWallet }
