import { getWethAddrIfIsEth } from './address'
import { getTokenBalance } from './ethereum'
import { updaterStack } from '../worker'
import { utils } from 'ethers'

export const getTokenlonTokenBalance = async (token) => {
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  const balanceBN = await getTokenBalance({
    address: config.mmProxyContractAddress,
    contractAddress: getWethAddrIfIsEth(token.contractAddress, config),
  })
  return balanceBN ? +utils.formatUnits(balanceBN, token.decimal) : 0
}
