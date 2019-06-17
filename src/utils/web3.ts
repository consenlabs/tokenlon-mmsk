import * as Web3Export from 'web3'
import { config } from '../config'

const Web3 = Web3Export.default ? Web3Export.default : Web3Export

let web3 = null

export const getweb3 = () => {
  if (!web3) {
    web3 = new Web3(new Web3.providers.HttpProvider(config.PROVIDER_URL))
  }
  return web3
}