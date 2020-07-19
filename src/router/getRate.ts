import * as _ from 'lodash'
import { getIndicativePrice } from '../request/marketMaker'
import { validateRequest } from '../validations'
import { transferIndicativePriceResultToRateBody } from '../utils/rate'
import { translateQueryData } from '../utils/helper'

export const getRate = async (ctx) => {
  const { query } = ctx
  const updatedQueryData = translateQueryData(query)
  const errMsg = validateRequest(updatedQueryData)
  if (errMsg != null) {
    ctx.body = { result: false, message: errMsg }
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
