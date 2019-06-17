import * as _ from 'lodash'
import { getPairs } from '../request/marketMaker'
import { getSupportedTokens } from '../utils/token'

const check = async () => {
  let pairsFromMM = []

  try {
    pairsFromMM = await getPairs()
    if (!pairsFromMM) return 'pairs API no reponse'
    if (!pairsFromMM.length) return 'pairs API token array is empty'
    if (!pairsFromMM.every(pairStr => pairStr.indexOf('/') !== -1)) return 'pairs API pair str must be TokenA/TokenB'
  } catch (e) {
    return `pairs API request error ${e.message}`
  }

  try {
    const supportedTokenList = getSupportedTokens()
    if (supportedTokenList.length === 0) return 'intergrated supported token list is empty'
    if (supportedTokenList.length === 1) return `intergrated supported token list only has one token trade ${supportedTokenList[0].symbol}-${supportedTokenList[0].opposites[0]}`
  } catch (e) {
    return `imToken getTokenList error ${e.message}`
  }

  return ''
}

export default check