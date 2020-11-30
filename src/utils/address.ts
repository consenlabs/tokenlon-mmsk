import { NULL_ADDRESS } from '../constants'
import { MarketMakerConfig } from '../types'

export const getWethAddrIfIsEth = (address, config: MarketMakerConfig) => {
  return address.toLowerCase() === NULL_ADDRESS
    ? config.wethContractAddress.toLowerCase()
    : address.toLowerCase()
}
