import { Quoter } from '../request/marketMaker'
import { updaterStack } from '../worker'
import { Protocol, QueryInterface } from '../types'
import { validateNewOrderRequest, validateRequest } from '../validations'
import { ValidationError } from './errors'
import { addQuoteIdPrefix, constructQuoteResponse, preprocessQuote } from '../quoting'

import { assetDataUtils } from '0x-v2-order-utils'
import { buildSignedOrder as buildRFQV1SignedOrder } from '../signer/rfqv1'
import { buildSignedOrder } from '../signer/pmmv5'
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

interface Order {
  // quoteId is from market maker backend quoter.
  quoteId: string
  // protocol represents the order type as enum, [PMMV4, PMMV5, AMMV1, RFQV1, AMMV2].
  protocol: Protocol

  // Common fields
  makerAddress: string
  makerAssetAmount: string
  makerAssetAddress: string
  takerAddress: string
  takerAssetAmount: string
  takerAssetAddress: string
  expirationTimeSeconds: string
  // feeFactor is tokenlon protocol field, works like BPS, should <= 10000.
  feeFactor: number
  // salt represents the uniqueness of order, is to prevent replay attack.
  salt: string

  // 0x protocol specific fields
  makerAssetData: string
  takerAssetData: string
  senderAddress: string
  // For PMMV5, we use this field as receiver address (user address).
  feeRecipientAddress: string
  exchangeAddress: string

  // makerFee and takerFee are not used, but keep to make 0x order signature.
  makerFee: string
  takerFee: string

  // PMM/RFQ market maker signature
  makerWalletSignature: string

  // Extra data
  payload: string
}

interface Response {
  rate: NumberOrString
  minAmount: NumberOrString
  maxAmount: NumberOrString
  order?: Order
}

// use smallest decimals from [USDT/USDC: 6, BTC: 8, ETH: 18]
const TRUNCATE_PRECISION = 6

const findSuitablePrecision = (decimals: number): number => {
  return decimals < 8 ? TRUNCATE_PRECISION : 8
}

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
      amountBN.dividedBy(rate).toFixed(findSuitablePrecision(takerToken.decimal)),
      takerToken.decimal
    )
  } else {
    makerAssetAmount = fromUnitToDecimalBN(
      amountBN.times(rate).toFixed(findSuitablePrecision(makerToken.decimal)),
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
  const { side, amount, feefactor } = simpleOrder
  const baseToken = getTokenBySymbol(tokenList, simpleOrder.base)
  const quoteToken = getTokenBySymbol(tokenList, simpleOrder.quote)
  const makerToken = side === 'BUY' ? baseToken : quoteToken
  const takerToken = side === 'BUY' ? quoteToken : baseToken
  const foundTokenConfig = tokenConfigs.find((t) => t.symbol === makerToken.symbol)

  let fFactor = config.feeFactor || 10
  if (foundTokenConfig?.feeFactor) {
    // console.log('set fee factor from token config', { factor: foundTokenConfig.feeFactor })
    fFactor = foundTokenConfig.feeFactor
  }
  if (feefactor && !Number.isNaN(+feefactor) && +feefactor >= 0) {
    // console.log('set fee factor from query string', { queryFeeFactor })
    fFactor = +feefactor
  }

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

  // ETH -> WETH
  const makerAssetAddress = getWethAddrIfIsEth(
    makerToken.contractAddress,
    config.wethContractAddress
  )
  // ETH -> WETH
  const takerAssetAddress = getWethAddrIfIsEth(
    takerToken.contractAddress,
    config.wethContractAddress
  )

  return {
    makerAddress: config.mmProxyContractAddress.toLowerCase(),
    makerAssetAmount,
    makerAssetAddress: makerAssetAddress,
    makerAssetData: assetDataUtils.encodeERC20AssetData(makerAssetAddress),
    makerFee: toBN(0),

    takerAddress: config.userProxyContractAddress,
    takerAssetAmount,
    takerAssetAddress: takerAssetAddress,
    takerAssetData: assetDataUtils.encodeERC20AssetData(takerAssetAddress),
    takerFee: toBN(0),

    senderAddress: config.tokenlonExchangeContractAddress.toLowerCase(),
    feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
    expirationTimeSeconds: toBN(getTimestamp() + +config.orderExpirationSeconds),
    exchangeAddress: config.exchangeContractAddress,

    feeFactor: fFactor,
  }
}

export const newOrder = async (ctx) => {
  const { quoter, signer, chainID } = ctx
  const query: QueryInterface = {
    protocol: Protocol.PMMV5, // by default is v2 protocol
    ...ctx.query, // overwrite from request
  }

  try {
    let errMsg = validateRequest(query)
    if (errMsg) throw new ValidationError(errMsg)
    const { amount, uniqId, userAddr, protocol } = query
    errMsg = validateNewOrderRequest(amount, uniqId, userAddr)
    if (errMsg) throw new ValidationError(errMsg)

    const { simpleOrder, rateBody } = await requestMarketMaker(quoter, query)
    const config = updaterStack.markerMakerConfigUpdater.cacheResult
    const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
    const tokenList = getSupportedTokens()

    const { rate, minAmount, maxAmount, quoteId } = rateBody
    const order = getOrderAndFeeFactor(simpleOrder, rate, tokenList, tokenConfigs, config)

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
        resp.order = buildAMMV1Order(order, rateBody.makerAddress, config.wethContractAddress)
        break
      case Protocol.PMMV5:
        resp.order = await buildSignedOrder(
          signer,
          order,
          userAddr.toLowerCase(),
          config.addressBookV5.PMM
        )
        break
      case Protocol.RFQV1:
        resp.order = await buildRFQV1SignedOrder(
          signer,
          order,
          userAddr.toLowerCase(),
          chainID,
          config.addressBookV5.RFQ
        )
        break
      default:
        console.log(`unknown protocol ${protocol}`)
        throw new Error('Unrecognized protocol: ' + protocol)
    }

    resp.order.quoteId = quoteId
    resp.order.protocol = protocol

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
