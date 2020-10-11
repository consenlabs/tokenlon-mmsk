import * as _ from 'lodash'
import { getWethAddrIfIsEth } from './address'
import { fromDecimalToUnit } from './format'
import { getTokenBalance } from './ethereum'
import { updaterStack } from '../worker'

export const getTokenlonTokenBalance = async (token) => {
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  const balance = await getTokenBalance({
    address: config.mmProxyContractAddress,
    contractAddress: getWethAddrIfIsEth(token.contractAddress, config),
  }).then((balanceBN) => {
    return balanceBN ? fromDecimalToUnit(balanceBN, token.decimal).toNumber() : 0
  })
  return balance
}
