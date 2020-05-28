import * as httpClient from './http'
import * as zerorpcClient from './zerorpc'
import { DealOrder, ExceptionOrder } from '../../types'
import { IndicativePriceApiParams, IndicativePriceApiResult, PriceApiParams, PriceApiResult, NotifyOrderResult } from './interface'
import { config } from '../../config'
import { removeQuoteIdPrefix } from '../../utils/quoteId'

export const getPairs = (): Promise<string[]> => {
  return config.USE_ZERORPC ? zerorpcClient.getPairs() : httpClient.getPairs()
}

export const getIndicativePrice = (data: IndicativePriceApiParams): Promise<IndicativePriceApiResult> => {
  return config.USE_ZERORPC ? zerorpcClient.getIndicativePrice(data) : httpClient.getIndicativePrice(data)
}

export const getPrice = (data: PriceApiParams): Promise<PriceApiResult> => {
  return config.USE_ZERORPC ? zerorpcClient.getPrice(data) : httpClient.getPrice(data)
}

export const dealOrder = (params: DealOrder): Promise<NotifyOrderResult> => {
  const { quoteId } = params
  const data = {
    ...params,
    quoteId: removeQuoteIdPrefix(quoteId),
  }
  return config.USE_ZERORPC ? zerorpcClient.dealOrder(data) : httpClient.dealOrder(data)
}

export const exceptionOrder = (params: ExceptionOrder): Promise<NotifyOrderResult> => {
  const { quoteId } = params
  const data = {
    ...params,
    quoteId: removeQuoteIdPrefix(quoteId),
  }
  return config.USE_ZERORPC ? zerorpcClient.exceptionOrder(data) : httpClient.exceptionOrder(data)
}

// for binance mock
// export { getPairs, getPrice, getIndicativePrice } from '../mockBinance'

// export const dealOrder = (_data: any): Promise<any> => {
//   return Promise.resolve({
//     result: true,
//   })
// }