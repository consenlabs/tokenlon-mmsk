import * as readlineSync from 'readline-sync'
import { ConfigForStart } from './types'
import { Wallet } from 'ethers'
import { GcpKmsSignerCredentials, GcpKmsSigner } from '@tokenlon/ethers-gcp-kms-signer'
import * as path from 'path'

const config = {
  EXCHANGE_URL: null,
  PROVIDER_URL: null,

  WALLET_ADDRESS: null,
  WALLET_PRIVATE_KEY: null,
  WALLET_KEY_VERSION_NAME: null,
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

const getWallet = async (): Promise<GcpKmsSigner> => {
  if (config.WALLET_PRIVATE_KEY) {
    const wallet = new Wallet(
      config.WALLET_PRIVATE_KEY.startsWith('0x')
        ? config.WALLET_PRIVATE_KEY
        : '0x' + config.WALLET_PRIVATE_KEY
    )
    return wallet as any as GcpKmsSigner
  } else if (config.WALLET_KEY_VERSION_NAME) {
    const signer = new GcpKmsSigner(getKmsCredentials(config.WALLET_KEY_VERSION_NAME))
    return signer
  } else {
    return null
  }
}

const getKmsCredentials = (fullVersionedKeyName: string): GcpKmsSignerCredentials => {
  if (!fullVersionedKeyName || fullVersionedKeyName.length === 0) {
    return null
  }
  const strSplits = fullVersionedKeyName.split(path.sep)
  return {
    projectId: strSplits[1],
    locationId: strSplits[3],
    keyRingId: strSplits[5],
    keyId: strSplits[7],
    keyVersion: strSplits[9],
  }
}

export { config, setConfig, getWallet }
