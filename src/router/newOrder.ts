import * as _ from 'lodash'
import { getPrice } from '../request/marketMaker'
import { PriceApiResult } from '../request/marketMaker/interface'
import { getFormatedSignedOrder } from '../utils/order'
import { getSupportedTokens } from '../utils/token'
import { translateQueryData } from '../utils/helper'
import { updaterStack } from '../utils/intervalUpdater'
import { QueryInterface } from './interface'
import { checkParams } from '../validations'
import { transferPriceResultToRateBody } from '../utils/rate'

export const newOrder = async (ctx) => {
  const query: QueryInterface = ctx.query
  const updatedQueryData = translateQueryData(query)
  const checkResult = checkParams(updatedQueryData, true)
  let rateBody = {} as any

  if (!checkResult.result) {
    ctx.body = checkResult
    return
  }

  try {
    const { side } = updatedQueryData
    const priceResult = await getPrice(updatedQueryData as any)
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
    // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
    // 但是，Token Config 返回的配置是 feeFactor
    const { userAddr, feefactor } = updatedQueryData
    const config = updaterStack.markerMakerConfigUpdater.cacheResult
    const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
    const tokenList = getSupportedTokens()
    try {
      const orderFormated = getFormatedSignedOrder({
        simpleOrder: updatedQueryData,
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