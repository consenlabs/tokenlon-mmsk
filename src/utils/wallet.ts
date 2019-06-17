import { config } from '../config'
let wallet = null

export const getWallet = () => {
  if (!wallet) {
    wallet = {
      address: config.WALLET_ADDRESS,
      privateKey: config.WALLET_PRIVATE_KEY,
    }
  }
  return wallet
}
