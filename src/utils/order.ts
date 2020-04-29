import { MarketMakerConfig, Token, TokenConfig } from '../types'
import { assetDataUtils, generatePseudoRandomSalt, orderHashUtils, signatureUtils, SignerType, SignatureType } from '0x.js'
import * as _ from 'lodash'
import * as ethUtils from 'ethereumjs-util'
import { toBN } from './math'
import { getTokenBySymbol } from './token'
import { getTimestamp } from './timestamp'
import { fromUnitToDecimalBN, orderBNToString } from './format'
import { getWallet } from './wallet'
import { ecSignOrderHash } from './sign'
import { getWethAddrIfIsEth } from './address'
import { FEE_RECIPIENT_ADDRESS } from '../constants'

const getFixPrecision = (decimal) => {
  return decimal < 8 ? decimal : 9
}

interface GetOrderAndFeeFactorParams {
  simpleOrder: any
  rate: number | string
  tokenList: Token[]
  tokenConfigs: TokenConfig[]
  config: MarketMakerConfig
  queryFeeFactor?: number
}

interface GetFormatedSignedOrderParams extends GetOrderAndFeeFactorParams {
  userAddr: string
}

const getOrderAndFeeFactor = (params: GetOrderAndFeeFactorParams) => {
  const {simpleOrder, rate, tokenList, tokenConfigs, config, queryFeeFactor } = params
  const foundTokenConfig = tokenConfigs.find(t => t.symbol === takerToken.symbol)
  const feeFactor = !_.isUndefined(queryFeeFactor) && !_.isNaN(+queryFeeFactor) && +queryFeeFactor >= 0 ? +queryFeeFactor : (
    foundTokenConfig && foundTokenConfig.feeFactor ? foundTokenConfig.feeFactor : (config.feeFactor ? config.feeFactor : 0)
  )
  const baseToken = getTokenBySymbol(tokenList, simpleOrder.base)
  const quoteToken = getTokenBySymbol(tokenList, simpleOrder.quote)

  const { side, amount } = simpleOrder
  const useAmount = side === 'BUY' ? toBN((amount / (1 - feeFactor / 10000)).toFixed(Math.min(baseToken.decimal, 14))).toNumber() : amount
  const amountBN = toBN(useAmount)
  let makerToken = null
  let takerToken = null
  let makerAssetAmount = null
  let takerAssetAmount = null

  // 针对用户买，对于做市商是提供卖单
  // 用户用quote 买base，做市商要构建卖base 换quote的order
  // 因此 order makerToken 是 base，takerToken 是 quote
  // 例如：用户 ETH -> DAI
  // rate 200
  // side BUY

  // order makerToken is DAI
  // order takerToken is WETH
  // order makerAssetAmount is amount(DAI / base amount)
  // order takerAssetAmount is amount of WETH (amount / rate)
  if (side === 'BUY') {
    makerToken = baseToken
    takerToken = quoteToken
    const makerTokenPrecision = getFixPrecision(makerToken.decimal)
    const takerTokenPrecision = getFixPrecision(takerToken.decimal)
    makerAssetAmount = fromUnitToDecimalBN(
      amountBN.toFixed(makerTokenPrecision), makerToken.decimal)
    takerAssetAmount = fromUnitToDecimalBN(
      (amountBN.dividedBy(rate)).toFixed(takerTokenPrecision), takerToken.decimal)

  // user side SELL
  } else {
    makerToken = quoteToken
    takerToken = baseToken
    const makerTokenPrecision = getFixPrecision(makerToken.decimal)
    const takerTokenPrecision = getFixPrecision(takerToken.decimal)
    makerAssetAmount = fromUnitToDecimalBN(
      (amountBN.times(rate)).toFixed(makerTokenPrecision), makerToken.decimal)
    takerAssetAmount = fromUnitToDecimalBN(
      amountBN.toFixed(takerTokenPrecision), takerToken.decimal)
  }

  const order = {
    makerAddress: config.mmProxyContractAddress.toLowerCase(),
    makerAssetAmount,
    makerAssetData: assetDataUtils.encodeERC20AssetData(getWethAddrIfIsEth(makerToken.contractAddress, config)),
    makerFee: toBN(0),

    takerAddress: config.userProxyContractAddress,
    takerAssetAmount,
    takerAssetData: assetDataUtils.encodeERC20AssetData(getWethAddrIfIsEth(takerToken.contractAddress, config)),
    takerFee: toBN(0),

    senderAddress: config.tokenlonExchangeContractAddress.toLowerCase(),
    feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
    expirationTimeSeconds: toBN(getTimestamp() + (+config.orderExpirationSeconds)),
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
    ]),
  )

  const signature = ecSignOrderHash(
    wallet.privateKey,
    hash,
    wallet.address,
    SignerType.Default,
  )

  const walletSign = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(signature).slice(0, 65),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ]),
  )
  const makerWalletSignature = signatureUtils.convertToSignatureWithType(walletSign, SignatureType.Wallet)

  const signedOrder = {
    ...o,
    feeFactor,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}