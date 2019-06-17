import { IndicativePriceApiResult, PriceApiResult } from '../request/marketMaker/interface'
import { SIDE } from '../types'
import { toBN } from './math'
import { addQuoteIdPrefix } from './quoteId'

export const transferIndicativePriceResultToRateBody = (priceResult: IndicativePriceApiResult, side: SIDE) => {
  const { minAmount, maxAmount, message } = priceResult
  if (priceResult.exchangeable === false || !priceResult.price) {
    return {
      result: false,
      exchangeable: false,
      minAmount,
      maxAmount,
      message: message || 'Can\'t support this trade',
    }
  }

  const rate = side === 'BUY' ? 1 / priceResult.price : priceResult.price
  return {
    result: true,
    exchangeable: true,
    minAmount,
    maxAmount,
    rate: toBN((+rate).toFixed(8)).toNumber(),
  }
}

export const transferPriceResultToRateBody = (priceResult: PriceApiResult, side: SIDE) => {
  const { minAmount, maxAmount } = priceResult
  const rateBody = transferIndicativePriceResultToRateBody(priceResult, side)

  if (rateBody.result && rateBody.exchangeable) {
    if (!priceResult.quoteId) {
      return {
        result: false,
        exchangeable: false,
        minAmount,
        maxAmount,
        message: 'quoteId must be a string',
      }
    }
    Object.assign(rateBody, {
      quoteId: addQuoteIdPrefix(priceResult.quoteId),
    })
  }

  return rateBody
}