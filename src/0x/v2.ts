import {
  assetDataUtils,
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
  SignerType,
} from '0x-v2-order-utils'
import { BigNumber } from '@0xproject/utils'
import * as _ from 'lodash'
import * as ethUtils from 'ethereumjs-util'

import { MarketMakerConfig, Token, TokenConfig } from '../types'
import { toBN } from '../utils/math'
import { getTokenBySymbol } from '../utils/token'
import { getTimestamp } from '../utils/timestamp'
import { fromUnitToDecimalBN, orderBNToString } from '../utils/format'
import { ecSignOrderHash } from '../utils/sign'
import { getWethAddrIfIsEth } from '../utils/address'
import { getWallet } from '../config'
import { FEE_RECIPIENT_ADDRESS } from '../constants'
import cryptoRandomString from 'crypto-random-string'

const getFixPrecision = (decimal) => {
  return decimal < 8 ? decimal : 8
}

interface SimpleOrder {
  side: string
  base: string
  quote: string
  amount?: number
}

interface GetOrderAndFeeFactorParams {
  simpleOrder: SimpleOrder
  rate: number | string
  tokenList: Token[]
  tokenConfigs: TokenConfig[]
  config: MarketMakerConfig
  queryFeeFactor?: number
}

interface GetFormatedSignedOrderParams extends GetOrderAndFeeFactorParams {
  userAddr: string
}

export function extractAssetAmounts(
  makerToken,
  takerToken,
  side,
  rate: number | string,
  amountBN: BigNumber
) {
  let makerAssetAmount, takerAssetAmount
  // order makerToken is DAI
  // order takerToken is WETH
  // order makerAssetAmount is amount(DAI / base amount)
  // order takerAssetAmount is amount of WETH (amount / rate)
  if (side === 'BUY') {
    const makerTokenPrecision = 6
    const takerTokenPrecision = getFixPrecision(takerToken.decimal)
    makerAssetAmount = fromUnitToDecimalBN(
      amountBN.toFixed(makerTokenPrecision),
      makerToken.decimal
    )
    takerAssetAmount = fromUnitToDecimalBN(
      amountBN.dividedBy(rate).toFixed(takerTokenPrecision),
      takerToken.decimal
    )

    // user side SELL
  } else {
    const makerTokenPrecision = getFixPrecision(makerToken.decimal)
    const takerTokenPrecision = 6
    makerAssetAmount = fromUnitToDecimalBN(
      amountBN.times(rate).toFixed(makerTokenPrecision),
      makerToken.decimal
    )
    takerAssetAmount = fromUnitToDecimalBN(
      amountBN.toFixed(takerTokenPrecision),
      takerToken.decimal
    )
  }
  return { makerAssetAmount, takerAssetAmount }
}

const getOrderAndFeeFactor = (params: GetOrderAndFeeFactorParams) => {
  const { simpleOrder, rate, tokenList, tokenConfigs, config, queryFeeFactor } = params
  const { side, amount } = simpleOrder
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

export const getFormatedSignedOrder = (params: GetFormatedSignedOrderParams) => {
  const { userAddr } = params
  const { order, feeFactor } = getOrderAndFeeFactor(params)
  const wallet = getWallet()

  const o = {
    ...order,
    salt: generatePseudoRandomSalt(),
  }
  const orderHash = orderHashUtils.getOrderHashHex(o)

  const hash = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(orderHash),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ])
  )

  const signature = ecSignOrderHash(wallet.privateKey, hash, wallet.address, SignerType.Default)

  const walletSign = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(signature).slice(0, 65),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ])
  )
  const makerWalletSignature = signatureUtils.convertToSignatureWithType(
    walletSign,
    SignatureType.Wallet
  )

  const signedOrder = {
    ...o,
    feeFactor,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}

export const getMockSignedOrder = (params: GetFormatedSignedOrderParams) => {
  const { order, feeFactor } = getOrderAndFeeFactor(params)
  const o = {
    ...order,
    salt: generatePseudoRandomSalt(),
  }
  const makerWalletSignature = cryptoRandomString({ length: 40 })
  const signedOrder = {
    ...o,
    feeFactor,
    makerWalletSignature,
  }
  return orderBNToString(signedOrder)
}
