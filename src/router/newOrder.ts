import { getPrice } from '../request/marketMaker'
import { PriceApiResult } from '../request/marketMaker/interface'
import { getFormatedSignedOrder } from '../utils/order'
import { getSupportedTokens } from '../utils/token'
import { updaterStack } from '../utils/intervalUpdater'
import { Protocol, QueryInterface, TradeMode } from '../types'
import { validateNewOrderRequest, validateRequest } from '../validations'
import { signOrderByMaker } from '../0x/v3/sign_order'
import { getWallet } from '../utils/wallet'
import { PrivateKeyWalletSubprovider } from '@0x/subproviders'
import { SignedOrder } from '0x-v3-order-utils'
import { ValidationError } from './errors'
import { appendQuoteIdToQuoteReponse, translateQueryData } from '../quoting'

async function requestMarketMaker(query: QueryInterface) {
  const simpleOrder = translateQueryData(query)
  // request to market maker backend
  const { side } = simpleOrder
  const priceResult = await getPrice(simpleOrder as any)
  const rateBody = appendQuoteIdToQuoteReponse(priceResult as PriceApiResult, side) as any
  return { simpleOrder, rateBody }
}

function assembleProtocolV2Response(rateBody, simpleOrder: QueryInterface) {
  const { rate, minAmount, maxAmount, quoteId } = rateBody
  // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
  // 但是，Token Config 返回的配置是 feeFactor
  const { userAddr, feefactor } = simpleOrder
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
  const tokenList = getSupportedTokens()
  const orderFormated = getFormatedSignedOrder({
    simpleOrder,
    rate,
    userAddr: userAddr.toLowerCase(),
    tokenList,
    tokenConfigs,
    config,
    queryFeeFactor: feefactor,
  })
  return {
    rate,
    minAmount,
    maxAmount,
    order: {
      ...orderFormated,
      quoteId,
    },
  }
}

function assembleProtocolV3Response(makerReturnsRate) {
  const { rate, minAmount, maxAmount, quoteId } = makerReturnsRate
  const pkw = new PrivateKeyWalletSubprovider(getWallet().privateKey)
  const signedOrder = signOrderByMaker(makerReturnsRate, pkw)
  return {
    rate,
    minAmount,
    maxAmount,
    quoteId,
    signedOrder,
  }
}

export const newOrder = async (ctx) => {
  const query: QueryInterface = {
    protocol: Protocol.ZeroXV2, // by default is v2 protocol
    mode: TradeMode.RFQStream, // by default is rfq stream
    ...ctx.query,
  }

  try {
    let errMsg = validateRequest(query)
    if (errMsg) throw new ValidationError(errMsg)
    const { amount, uniqId, userAddr } = query
    errMsg = validateNewOrderRequest(amount, uniqId, userAddr)
    if (errMsg) throw new ValidationError(errMsg)

    const { simpleOrder, rateBody } = await requestMarketMaker(query)

    if (!rateBody.result) {
      ctx.body = rateBody
    } else {
      let resp: {
        rate: any;
        minAmount: any;
        maxAmount: any; order?: { quoteId: any }; quoteId?: any; signedOrder?: Promise<SignedOrder> }
      switch (query.protocol) {
        case Protocol.ZeroXV2:
          resp = assembleProtocolV2Response(rateBody, simpleOrder)
          break;
        case Protocol.ZeroXV3:
          resp = assembleProtocolV3Response(rateBody)
          break;
        default:
          throw new Error('Unknown protocol')
      }

      ctx.body = {
        result: true,
        exchangeable: true,
        ...resp
      }
    }
  } catch (e) {
    ctx.body = {
      result: false,
      exchangeable: false,
      message: e.message,
    }
  }
}
