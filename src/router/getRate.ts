import * as _ from 'lodash'
import { getIndicativePrice } from '../request/marketMaker'
import { checkParams } from '../validations'
import { transferIndicativePriceResultToRateBody } from '../utils/rate'
import { translateQueryData } from '../utils/token'

export const getRate = async (ctx) => {
  const { query } = ctx
  const updatedQueryData = translateQueryData(query)
  const checkResult = checkParams(query, false)
  if (!checkResult.result) {
    ctx.body = checkResult
    return
  }

  try {
    const { side } = updatedQueryData
    const priceResult = await getIndicativePrice(updatedQueryData)
    ctx.body = transferIndicativePriceResultToRateBody(priceResult, side)

  } catch (e) {
    ctx.body = {
      result: false,
      exchangeable: false,
      message: e.message,
    }
  }
}