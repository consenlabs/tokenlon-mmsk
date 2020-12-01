import { PriceApiResult, Quoter } from '../request/marketMaker'
import { getFormatedSignedOrder, getAMMSignedOrder } from '../0x/v2'
import { getSupportedTokens } from '../utils/token'
import { updaterStack } from '../worker'
import { Protocol, QueryInterface, TradeMode } from '../types'
import { validateNewOrderRequest, validateRequest } from '../validations'
import { signOrderByMaker } from '../0x/v3'
import { getWallet } from '../config'
import { ValidationError } from './errors'
import { appendQuoteIdToQuoteReponse, translateQueryData } from '../quoting'

import { PrivateKeyWalletSubprovider } from '@0x/subproviders'
import { orderHashUtils, SignedOrder } from '0x-v3-order-utils'
import { buildSignedOrder } from '../signer/pmmv5'

async function requestMarketMaker(quoter: Quoter, query: QueryInterface) {
  const simpleOrder = translateQueryData(query)
  // request to market maker backend
  const { side } = simpleOrder
  const priceResult = await quoter.getPrice(simpleOrder as any)
  const rateBody = appendQuoteIdToQuoteReponse(priceResult as PriceApiResult, side) as any
  return { simpleOrder, rateBody }
}

type NumberOrString = number | string

interface Response {
  rate: NumberOrString
  minAmount: NumberOrString
  maxAmount: NumberOrString
  order?: {
    quoteId: any
  }
  quoteId?: any
  signedOrder?: SignedOrder
  orderHash?: string
}

function assembleProtocolPMMV5Response(rateBody, simpleOrder: QueryInterface): Response {
  const { rate, minAmount, maxAmount, quoteId } = rateBody
  // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
  // 但是，Token Config 返回的配置是 feeFactor
  const { userAddr } = simpleOrder
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
  const tokenList = getSupportedTokens()
  const formattedOrder = buildSignedOrder({
    simpleOrder,
    rate,
    userAddr: userAddr.toLowerCase(),
    tokenList,
    tokenConfigs,
    config,
    queryFeeFactor: simpleOrder.feefactor,
  })
  return {
    rate,
    minAmount,
    maxAmount,
    order: {
      ...formattedOrder,
      quoteId,
    },
  }
}

function assembleProtocolAMMResponse(rateBody, simpleOrder: QueryInterface): Response {
  const { rate, minAmount, maxAmount, quoteId, makerAddress } = rateBody
  // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
  // 但是，Token Config 返回的配置是 feeFactor
  const { userAddr } = simpleOrder
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
  const tokenList = getSupportedTokens()
  const formattedOrder = getAMMSignedOrder({
    makerAddress: makerAddress,
    simpleOrder,
    rate,
    userAddr: userAddr.toLowerCase(),
    tokenList,
    tokenConfigs,
    config,
    queryFeeFactor: simpleOrder.feefactor,
  })
  return {
    rate,
    minAmount,
    maxAmount,
    order: {
      ...formattedOrder,
      quoteId,
    },
  }
}

function assembleProtocolV2Response(rateBody, simpleOrder: QueryInterface): Response {
  const { rate, minAmount, maxAmount, quoteId } = rateBody
  // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
  // 但是，Token Config 返回的配置是 feeFactor
  const { userAddr } = simpleOrder
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
  const tokenList = getSupportedTokens()
  const formattedOrder = getFormatedSignedOrder({
    simpleOrder,
    rate,
    userAddr: userAddr.toLowerCase(),
    tokenList,
    tokenConfigs,
    config,
    queryFeeFactor: simpleOrder.feefactor,
  })
  return {
    rate,
    minAmount,
    maxAmount,
    order: {
      ...formattedOrder,
      quoteId,
    },
  }
}

async function assembleProtocolV3Response(
  makerReturnsRate,
  simpleOrder,
  chainID: number
): Promise<Response> {
  const { mmProxyContractAddress, feeFactor } = updaterStack.markerMakerConfigUpdater.cacheResult
  const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult

  const { rate, minAmount, maxAmount, quoteId } = makerReturnsRate
  const pkw = new PrivateKeyWalletSubprovider(getWallet().privateKey)
  const { tokenListFromImtokenUpdater: tokenList } = updaterStack
  const signedOrder = await signOrderByMaker(
    {
      chainID,
      userAddr: simpleOrder.userAddr,
      makerAddr: mmProxyContractAddress,
      simpleOrder,
      tokenList: tokenList.cacheResult,
      tokenConfigs,
      cfgFeeFactor: feeFactor,
      ...makerReturnsRate,
    },
    pkw
  )
  const orderHash = orderHashUtils.getOrderHash(signedOrder)
  return {
    rate,
    minAmount,
    maxAmount,
    quoteId,
    orderHash,
    signedOrder,
  }
}

export const newOrder = async (ctx) => {
  const query: QueryInterface = {
    protocol: Protocol.ZeroXV2, // by default is v2 protocol
    mode: TradeMode.RFQStream, // by default is rfq stream
    ...ctx.query,
  }

  const quoter = ctx.quoter
  // NOTICE: only v3 support RFQT mode
  if (query.protocol == Protocol.ZeroXV3) {
    query['mode'] = TradeMode.RFQTaker
  }

  try {
    let errMsg = validateRequest(query)
    if (errMsg) throw new ValidationError(errMsg)
    const { amount, uniqId, userAddr } = query
    errMsg = validateNewOrderRequest(amount, uniqId, userAddr)
    if (errMsg) throw new ValidationError(errMsg)

    const { simpleOrder, rateBody } = await requestMarketMaker(quoter, query)
    let resp: Response
    switch (query.protocol) {
      case Protocol.ZeroXV2:
        resp = assembleProtocolV2Response(rateBody, simpleOrder)
        break
      case Protocol.ZeroXV3:
        resp = await assembleProtocolV3Response(rateBody, simpleOrder, ctx.chainID)
        break
      case Protocol.AMMV1:
        // TODO: add real AMM order call data here
        resp = assembleProtocolAMMResponse(rateBody, simpleOrder)
        break
      case Protocol.PMMV5:
        resp = assembleProtocolPMMV5Response(rateBody, simpleOrder)
        break
      default:
        console.warn(`unknown protocol ${query.protocol}, fallback to 0x v2`)
        resp = assembleProtocolV2Response(rateBody, simpleOrder)
        break
    }

    ctx.body = {
      result: true,
      exchangeable: true,
      ...resp,
    }
  } catch (e) {
    console.error(e.stack)
    ctx.body = {
      result: false,
      exchangeable: false,
      message: e.message,
    }
  }
}
