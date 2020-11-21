import { DealOrder, ExceptionOrder, SIDE } from '../../types'

export interface Quoter {
  getPairs(): Promise<string[]>

  getIndicativePrice(data: IndicativePriceApiParams): Promise<IndicativePriceApiResult>

  getPrice(data: PriceApiParams): Promise<PriceApiResult>

  dealOrder(params: DealOrder): Promise<NotifyOrderResult>

  exceptionOrder(params: ExceptionOrder): Promise<NotifyOrderResult>
}

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
  makerAddress?: string
  message?: string
}

export interface PriceApiParams extends IndicativePriceApiParams {
  amount: number
}

export interface PriceApiResult extends IndicativePriceApiResult {
  quoteId: string
}

export interface NotifyOrderResult {
  result: boolean
}
