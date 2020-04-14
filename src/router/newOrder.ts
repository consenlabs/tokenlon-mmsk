import * as _ from 'lodash'
import { getPrice } from '../request/marketMaker'
import { PriceApiResult } from '../request/marketMaker/interface'
import { getFormatedSignedOrder } from '../utils/order'
import { getSupportedTokens, translateBaseQuote } from '../utils/token'
import { updaterStack } from '../utils/intervalUpdater'
import { checkParams } from '../validations'
import { transferPriceResultToRateBody } from '../utils/rate'

export const newOrder = async (ctx) => {
  const { query } = ctx
  translateBaseQuote(query)
  const checkResult = checkParams(query, true)
  let rateBody = {} as any
  const simpleOrder = query

  if (!checkResult.result) {
    ctx.body = checkResult
    return
  }

  try {
    const { side, amount, feefactor } = query
    const useAmount = side === 'BUY' ? amount / ( 1 - feefactor / 10000) : amount
    Object.assign(simpleOrder, {
      amount: useAmount,
    })
    const priceResult = await getPrice(simpleOrder)
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
    const { userAddr, feefactor } = simpleOrder
    const config = updaterStack.markerMakerConfigUpdater.cacheResult
    const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
    const tokenList = getSupportedTokens()
    try {
      const orderFormated = getFormatedSignedOrder({
        simpleOrder,
        rate,
        userAddr: userAddr.toLowerCase(),
        tokenList,
        tokenConfigs,
        config,
        queryFeeFactor: feefactor,
      })
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