import * as _ from 'lodash'
import { getIndicativePrice } from '../request/marketMaker'
import { checkParams } from '../validations'
import { transferIndicativePriceResultToRateBody } from '../utils/rate'
import { translateBaseQuote } from '../utils/token'

export const getRate = async (ctx) => {
  const { query } = ctx
  translateBaseQuote(query)
  const checkResult = checkParams(query, false)
  if (!checkResult.result) {
    ctx.body = checkResult
    return
  }

  try {
    const { side } = query
    const priceResult = await getIndicativePrice(query)
    ctx.body = transferIndicativePriceResultToRateBody(priceResult, side)

  } catch (e) {
    ctx.body = {
      result: false,
      exchangeable: false,
      message: e.message,
    }
  }
}