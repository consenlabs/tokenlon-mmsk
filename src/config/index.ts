import * as readlineSync from 'readline-sync'
import { ConfigForStart } from '../types'
import { Wallet } from 'ethers'
import fs from 'fs'

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
    const password = readlineSync.question("Please input your keystore's password: ", {
      hideEchoBack: true,
    })

    let content = fs.readFileSync(conf.WALLET_KEYSTORE.toString()).toString()
    Promise.resolve(
      Wallet.fromEncryptedJson(content, password).then((wallet) => {
        conf.WALLET_PRIVATE_KEY = wallet.privateKey
      })
    )
  }
  return Object.assign(config, conf)
}

const getWallet = () => {
  return {
    address: config.WALLET_ADDRESS,
    privateKey: config.WALLET_PRIVATE_KEY,
  }
}

export { config, setConfig, getWallet }
