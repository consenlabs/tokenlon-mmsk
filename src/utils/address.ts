import { ETH_ADDRESS } from '../constants'
import { MarketMakerConfig } from '../types'

export const getWethAddrIfIsEth = (address, config: MarketMakerConfig) => {
  return address.toLowerCase() === ETH_ADDRESS ?
    config.wethContractAddress.toLowerCase() : address.toLowerCase()
}

export const addressWithout0x = (address) => {
  if (address.startsWith('0x')) {
    return address.slice(2).toLowerCase()
  }
  return address.toLowerCase()
}