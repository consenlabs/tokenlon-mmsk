import * as _ from 'lodash'
import { getSupportedTokens } from '../utils/token'
import { NULL_ADDRESS } from '../constants'

const checkMinAndMaxAmount = (resp, { base, quote, side }) => {
  const { minAmount, maxAmount } = resp
  if (minAmount === void 0 || maxAmount === void 0)
    return `${base}-${quote} ${side} trade must have minAmount and maxAmount field`
  if (minAmount > maxAmount)
    return `${base}-${quote} ${side} trade's minAmount largerer than maxAmount`
}

const checkBaseQuoteTrade = async (
  apiFunc,
  { base, quote, baseAddress, quoteAddress },
  isIndicative,
  tokenSupported
) => {
  const uniqId = 'uniq'
  const amountArr = isIndicative ? [undefined, 0, 0.1] : [0.1, 100]

  for (let side of ['BUY', 'SELL']) {
    for (let item of [
      { base, quote, baseAddress, quoteAddress },
      {
        base: quote,
        quote: base,
        baseAddress: quoteAddress,
        quoteAddress: baseAddress,
      },
    ]) {
      for (let amount of amountArr) {
        const params = { ...item, side }
        if (amount !== undefined) {
          Object.assign(params, { amount })
        }
        if (!isIndicative) {
          Object.assign(params, { uniqId })
        }
        try {
          console.log('params:', JSON.stringify(params))
          const resp = await apiFunc(params)
          resp.exchangeable = resp.exchangeable || resp.exchangable
          console.log('response:', JSON.stringify(resp))

          if (!resp.result || !resp.exchangeable) {
            // 数量不存在的报价，必须支持
            if (tokenSupported && amount === undefined)
              return `can not support ${base}-${quote} ${side} trade`

            // 必须包含 message
            if (!resp.message)
              return `${base}-${quote} ${side} message is needed if result or exchangeable is false`
          } else {
            if (tokenSupported) {
              // 价格不存在问题
              if (!resp.price) return `${base}-${quote} ${side} price ${resp.price} incorrect`

              // price 接口 必须包含 quoteId 字段
              if (!isIndicative && (!resp.quoteId || !_.isString(resp.quoteId)))
                return `${base}-${quote} ${side} response need an non-empty string quoteId`

              // TODO: 价格合理性检查
            }
          }

          // 支持的 token 必须包含最大最小值
          if (tokenSupported) {
            const minMaxAmountValidateMsg = checkMinAndMaxAmount(resp, { base, quote, side })
            if (minMaxAmountValidateMsg) return minMaxAmountValidateMsg
          }
        } catch (e) {
          return `API request ${base}-${quote} ${side} error ${e.message}`
        }
      }
    }
  }
}

export const priceCheckHelper = async (apiFunc, isIndicative) => {
  const supportedTokens = getSupportedTokens()

  // ETH token
  const ethToken = supportedTokens.find((t) => t.symbol === 'ETH')
  let base = ethToken.symbol
  let baseAddress = NULL_ADDRESS
  let quote = ethToken.opposites[0].symbol
  let quoteAddress = ethToken.opposites[0].contractAddress

  const supportedTokenTradeValidateMsg = await checkBaseQuoteTrade(
    apiFunc,
    { base, quote, baseAddress, quoteAddress },
    isIndicative,
    true
  )
  if (supportedTokenTradeValidateMsg) return supportedTokenTradeValidateMsg

  quote = 'ABCDEFG'
  quoteAddress = '0xabcdeabcdeabcdeabcdeabcdeabcdeabcdeabcde'
  const unsupportedTokenTradeValidateMsg = await checkBaseQuoteTrade(
    apiFunc,
    { base, quote, baseAddress, quoteAddress },
    isIndicative,
    false
  )
  if (unsupportedTokenTradeValidateMsg) return unsupportedTokenTradeValidateMsg

  const otherToken = supportedTokens.find((t) => t.symbol !== 'ETH' && t.opposites.length > 1)

  if (otherToken) {
    base = otherToken.symbol
    baseAddress = otherToken.contractAddress
    const quoteToken = otherToken.opposites.find((token) => token.symbol !== 'ETH')
    if (quoteToken) {
      quote = quoteToken.symbol
      quoteAddress = quoteToken.contractAddress
      const twoErc20TokenTradeValidateMsg = await checkBaseQuoteTrade(
        apiFunc,
        { base, quote, baseAddress, quoteAddress },
        isIndicative,
        true
      )
      if (twoErc20TokenTradeValidateMsg) return twoErc20TokenTradeValidateMsg
    }
  }
}
