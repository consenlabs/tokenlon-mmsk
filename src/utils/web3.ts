import * as Web3 from 'web3'
import * as _ from 'lodash'
import { BigNumber } from '@0xproject/utils'
import { config } from '../config'

let provider = null

type Handler = (web3: any) => Promise<BigNumber>

export const web3RequestWrap = async (handler: Handler) => {
  const urls = _.isArray(config.PROVIDER_URL) ? config.PROVIDER_URL : [config.PROVIDER_URL]
  let error = null

  for (const url of urls) {
    try {
      if (!provider || error) {
        provider = new Web3(new Web3.providers.HttpProvider(url))
      }
      return await handler(provider)
    } catch (e) {
      error = e
    }
  }

  throw error ? error : new Error('unknown web3 error')
}
