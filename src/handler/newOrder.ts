import { Quoter } from '../request/marketMaker'
import { updaterStack } from '../worker'
import { Protocol, QueryInterface } from '../types'
import { validateNewOrderRequest, validateRequest } from '../validations'
import { ValidationError } from './errors'
import { addQuoteIdPrefix, constructQuoteResponse, preprocessQuote } from '../quoting'

import { assetDataUtils, SignedOrder } from '0x-v2-order-utils'
import { buildSignedOrder } from '../signer/pmmv5'
import { buildSignedOrder as buildLagacyOrder } from '../signer/pmmv4'
import { buildSignedOrder as buildAMMV1Order } from '../signer/ammv1'
import { FEE_RECIPIENT_ADDRESS } from '../constants'
import {
  BigNumber,
  fromUnitToDecimalBN,
  toBN,
  getSupportedTokens,
  getTokenBySymbol,
  getWethAddrIfIsEth,
  getTimestamp,
} from '../utils'

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

// use smallest decimals from [USDT/USDC: 6, BTC: 8, ETH: 18]
const TRUNCATE_PRECISION = 6

// request getPrice API from market maker backend
async function requestMarketMaker(quoter: Quoter, query: QueryInterface) {
  const simpleOrder = preprocessQuote(query)
  // request to market maker backend
  const { side } = simpleOrder
  const priceResult = await quoter.getPrice(simpleOrder as any)
  console.log('got result from market maker', { simpleOrder, priceResult })
  const rateBody = {
    ...constructQuoteResponse(priceResult, side),
    quoteId: addQuoteIdPrefix(priceResult.quoteId),
  }
  return { simpleOrder, rateBody }
}

function extractAssetAmounts(
  makerToken,
  takerToken,
  side,
  rate: number | string,
  amountBN: BigNumber
) {
  let makerAssetAmount, takerAssetAmount
  if (side === 'BUY') {
    makerAssetAmount = fromUnitToDecimalBN(
      amountBN.toFixed(makerToken.precision),
      makerToken.decimal
    )
    takerAssetAmount = fromUnitToDecimalBN(
      amountBN.dividedBy(rate).toFixed(TRUNCATE_PRECISION),
      takerToken.decimal
    )
  } else {
    makerAssetAmount = fromUnitToDecimalBN(
      amountBN.times(rate).toFixed(TRUNCATE_PRECISION),
      makerToken.decimal
    )
    takerAssetAmount = fromUnitToDecimalBN(
      amountBN.toFixed(takerToken.precision),
      takerToken.decimal
    )
  }
  return { makerAssetAmount, takerAssetAmount }
}

function getOrderAndFeeFactor(simpleOrder, rate, tokenList, tokenConfigs, config) {
  const { side, amount, queryFeeFactor } = simpleOrder
  const baseToken = getTokenBySymbol(tokenList, simpleOrder.base)
  const quoteToken = getTokenBySymbol(tokenList, simpleOrder.quote)
  const makerToken = side === 'BUY' ? baseToken : quoteToken
  const takerToken = side === 'BUY' ? quoteToken : baseToken
  const foundTokenConfig = tokenConfigs.find((t) => t.symbol === makerToken.symbol)

  let fFactor = config.feeFactor || 0
  if (foundTokenConfig?.feeFactor) {
    // console.log('set fee factor from token config', { factor: foundTokenConfig.feeFactor })
    fFactor = foundTokenConfig.feeFactor
  }
  if (queryFeeFactor && !Number.isNaN(+queryFeeFactor) && +queryFeeFactor >= 0) {
    // console.log('set fee factor from query string', { queryFeeFactor })
    fFactor = +queryFeeFactor
  }
  const feeFactor = fFactor

  // 针对用户买，对于做市商是提供卖单
  // 用户用quote 买base，做市商要构建卖base 换quote的order
  // 因此 order makerToken 是 base，takerToken 是 quote
  // 例如：用户 ETH -> DAI
  // rate 200
  // side BUY
  const { makerAssetAmount, takerAssetAmount } = extractAssetAmounts(
    makerToken,
    takerToken,
    side,
    rate,
    toBN(amount)
  )

  const order = {
    makerAddress: config.mmProxyContractAddress.toLowerCase(),
    makerAssetAmount,
    makerAssetData: assetDataUtils.encodeERC20AssetData(
      getWethAddrIfIsEth(makerToken.contractAddress, config)
    ),
    makerFee: toBN(0),

    takerAddress: config.userProxyContractAddress,
    takerAssetAmount,
    takerAssetData: assetDataUtils.encodeERC20AssetData(
      getWethAddrIfIsEth(takerToken.contractAddress, config)
    ),
    takerFee: toBN(0),

    senderAddress: config.tokenlonExchangeContractAddress.toLowerCase(),
    feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
    expirationTimeSeconds: toBN(getTimestamp() + +config.orderExpirationSeconds),
    exchangeAddress: config.exchangeContractAddress,
  }

  return {
    order,
    feeFactor,
  }
}

export const newOrder = async (ctx) => {
  const { quoter, signer } = ctx
  const query: QueryInterface = {
    protocol: Protocol.PMMV4, // by default is v2 protocol
    ...ctx.query, // overwrite from request
  }

  try {
    let errMsg = validateRequest(query)
    if (errMsg) throw new ValidationError(errMsg)
    const { amount, uniqId, userAddr, protocol } = query
    errMsg = validateNewOrderRequest(amount, uniqId, userAddr)
    if (errMsg) throw new ValidationError(errMsg)

    const { simpleOrder, rateBody } = await requestMarketMaker(quoter, query)
    const makerCfg = updaterStack.markerMakerConfigUpdater.cacheResult
    const config = updaterStack.markerMakerConfigUpdater.cacheResult
    const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
    const tokenList = getSupportedTokens()

    const { rate, minAmount, maxAmount, quoteId } = rateBody
    const { order, feeFactor } = getOrderAndFeeFactor(
      simpleOrder,
      rate,
      tokenList,
      tokenConfigs,
      config
    )

    const resp: Response = {
      rate,
      minAmount,
      maxAmount,
    }
    switch (protocol) {
      case Protocol.AMMV1:
        // directly use system token config
        {
          const tokenSymbol = simpleOrder.base
          const tokenConfig = tokenList.find(
            (token) => token.symbol.toUpperCase() === tokenSymbol.toUpperCase()
          )
          resp.minAmount = tokenConfig.minTradeAmount
          resp.maxAmount = tokenConfig.maxTradeAmount
        }
        resp.order = buildAMMV1Order(
          order,
          feeFactor,
          rateBody.makerAddress,
          config.wethContractAddress
        )
        break
      case Protocol.PMMV5:
        resp.order = await buildSignedOrder(
          signer,
          order,
          userAddr.toLowerCase(),
          feeFactor,
          config.addressBookV5.PMM
        )
        break
      default:
        console.log(`unknown protocol ${protocol}, fallback to 0x v2`)
        if (signer.address.toLowerCase() == makerCfg.mmProxyContractAddress.toLowerCase()) {
          throw new Error('eoa_signer_not_work_with_tokenlon_v4_order')
        }
        resp.order = buildLagacyOrder(signer, order, userAddr, feeFactor)
        break
    }

    resp.order.quoteId = quoteId

    ctx.body = {
      result: true,
      exchangeable: true,
      ...resp,
    }
    return resp
  } catch (e) {
    console.error(e.stack)
    ctx.body = {
      result: false,
      exchangeable: false,
      message: e.message,
    }
    return e.message
  }
}
