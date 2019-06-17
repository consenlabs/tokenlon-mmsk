import { SIDE } from '../../types'

export interface IndicativePriceApiParams {
  base: string
  quote: string
  side: SIDE
  amount?: number
}

export interface IndicativePriceApiResult {
  result: boolean
  exchangeable: boolean
  minAmount: number
  maxAmount: number
  price: number
  message?: string
}

export interface PriceApiParams extends IndicativePriceApiParams {
  amount: number
}

export interface PriceApiResult extends IndicativePriceApiResult {
  quoteId: string
}

export interface DealApiParams {
  makerToken: string
  takerToken: string
  makerTokenAmount: number
  takerTokenAmount: number
  quoteId: string
  timestamp: number
}

export interface DealApiResult {
  result: boolean
}