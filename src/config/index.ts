import * as readlineSync from 'readline-sync'
import * as keythereum from 'keythereum'
import { ConfigForStart } from '../types'

const config = {
  EXCHANGE_URL: null,
  PROVIDER_URL: null,

  WALLET_ADDRESS: null,
  WALLET_PRIVATE_KEY: null,
  USE_KEYSTORE: true,
  WALLET_KEYSTORE: null,
  MMSK_SERVER_PORT: null,

  USE_ZERORPC: null,
  HTTP_SERVER_ENDPOINT: null,
  ZERORPC_SERVER_ENDPOINT: null,

  NODE_ENV: 'DEVELOPMENT',
  SENTRY_DSN: null,
} as ConfigForStart

const setConfig = (conf: ConfigForStart) => {
  if (conf.USE_KEYSTORE) {
    const KEYSTORE_PASSWORD = readlineSync.question('Please input your keystore\'s password: ', {
      hideEchoBack: true,
    })
    const privateKeyBuf = keythereum.recover(KEYSTORE_PASSWORD, conf.WALLET_KEYSTORE)
    const privateKey = privateKeyBuf.toString('hex')
    conf.WALLET_PRIVATE_KEY = privateKey
  }
  return Object.assign(config, conf)
}

export {
  config,
  setConfig,
}