import * as _ from 'lodash'
import { getPrice } from '../request/marketMaker'
import { PriceApiResult } from '../request/marketMaker/interface'
import { getFormatedSignedOrder } from '../utils/order'
import { getSupportedTokens } from '../utils/token'
import { updaterStack } from '../utils/intervalUpdater'
import { checkParams } from '../validations'
import { transferPriceResultToRateBody } from '../utils/rate'

export const newOrder = async (ctx) => {
  const { query } = ctx
  const checkResult = checkParams(query, true)
  let rateBody = {} as any

  if (!checkResult.result) {
    ctx.body = checkResult
    return
  }

  try {
    const { side } = query
    const priceResult = await getPrice(query)
    rateBody = transferPriceResultToRateBody(priceResult as PriceApiResult, side) as any

  } catch (e) {
    ctx.body = {
      result: false,
      exchangeable: false,
      message: e.message,
    }
    return
  }

  if (!rateBody.result) {
    ctx.body = rateBody

  } else {
    const { rate, minAmount, maxAmount, quoteId } = rateBody
    const { userAddr } = query
    const config = updaterStack.markerMakerConfigUpdater.cacheResult
    const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
    const tokenList = getSupportedTokens()
    try {
      const orderFormated = getFormatedSignedOrder(
        ctx.query,
        rate,
        userAddr.toLowerCase(),
        tokenList,
        tokenConfigs,
        config,
      )
      ctx.body = {
        result: true,
        exchangeable: true,
        rate,
        minAmount,
        maxAmount,
        order: {
          ...orderFormated,
          quoteId,
        },
      }
    } catch (e) {
      ctx.body = {
        result: false,
        exchangeable: false,
        rate,
        minAmount,
        maxAmount,
        message: e.message,
      }
    }
  }
}