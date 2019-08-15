import * as Web3Export from 'web3'
import * as _ from 'lodash'
import { BigNumber } from '0x.js'
import { config } from '../config'

const Web3 = Web3Export.default ? Web3Export.default : Web3Export

let web3 = null

type Handler = (web3: any) => Promise<BigNumber>

export const web3RequestWrap = async (handler: Handler) => {
  const urls = _.isArray(config.PROVIDER_URL) ? config.PROVIDER_URL : [config.PROVIDER_URL]
  let error = null

  for (let url of urls) {
    try {
      if (!web3 || error) {
        web3 = new Web3(new Web3.providers.HttpProvider(url))
      }
      return await handler(web3)
    } catch (e) {
      error = e
    }
  }

  throw error ? error : new Error('unknown web3 error')
}