import { BigNumber } from '../utils'
import { MarketMakerConfig, Token, TokenConfig } from '../types'

export interface SimpleOrder {
  side: string
  base: string
  quote: string
  amount?: number
}

export interface GetOrderAndFeeFactorParams {
  simpleOrder: SimpleOrder
  rate: number | string
  tokenList: Token[]
  tokenConfigs: TokenConfig[]
  config: MarketMakerConfig
  queryFeeFactor?: number
}

export interface GetFormatedSignedOrderParams extends GetOrderAndFeeFactorParams {
  userAddr: string
}

export interface RFQOrder {
  takerAddr: string
  makerAddr: string
  takerAssetAddr: string
  makerAssetAddr: string
  takerAssetAmount: BigNumber
  makerAssetAmount: BigNumber
  salt: BigNumber
  deadline: number
  feeFactor: number
}
