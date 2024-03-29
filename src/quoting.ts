import { isNil, memoize } from 'lodash'
import { QueryInterface, SIDE, SupportedToken, TokenConfig } from './types'
import { IndicativePriceApiResult } from './request/marketMaker'
import { BackendError } from './handler/errors'
import { updaterStack } from './worker'
import { truncateAmount, toBN, getSupportedTokens } from './utils'

const DISPLAY_PRECEISION = 16

const getPrefix = (): string => `${updaterStack.markerMakerConfigUpdater.cacheResult.mmId}--`

export const addQuoteIdPrefix = (quoteId: string): string => `${getPrefix()}${quoteId}`

export const removeQuoteIdPrefix = (quoteId: string): string => {
  const prefix = getPrefix()
  if (quoteId.startsWith(prefix)) return quoteId.replace(prefix, '')
  return quoteId
}

export const constructQuoteResponse = (indicativePrice: IndicativePriceApiResult, side: SIDE) => {
  const { minAmount, maxAmount, message, makerAddress, salt } = indicativePrice
  if (indicativePrice.exchangeable === false || !indicativePrice.price) {
    throw new BackendError(
      message || `Can't support this trade: ${JSON.stringify(indicativePrice)}`
    )
  }

  const rate = side === 'BUY' ? 1 / indicativePrice.price : indicativePrice.price
  return {
    salt,
    minAmount,
    maxAmount,
    rate: (+rate).toFixed(DISPLAY_PRECEISION),
    makerAddress,
  }
}

// Process buy amount for WYSIWY
export function applyFeeToAmount(amount: number, feeFactor: number, precision: number): number {
  if (isNil(amount)) return amount
  const rate = toBN(1).sub(toBN(feeFactor).div(10000))
  return truncateAmount(toBN(amount).dividedBy(rate).toString(), precision)
}

function calcFeeFactorWhenBuy(tokenCfg: TokenConfig, factor: number | null): number {
  const queryFeeFactor = Number(factor)
  if (!isNaN(queryFeeFactor) && queryFeeFactor >= 0) {
    return queryFeeFactor
  } else if (tokenCfg && tokenCfg.feeFactor) {
    return tokenCfg.feeFactor
  }
  return null
}

const _getTokenCfg = (base, tokenConfigs) => {
  return tokenConfigs.find((t) => t.symbol.toUpperCase() === base)
}

const getTokenCfg = memoize(_getTokenCfg)

const _getToken = (base, tokens) => {
  return tokens.find((t) => t.symbol.toUpperCase() === base)
}

const getToken = memoize(_getToken)

// 处理接口大小写情况，转换为系统设定格式，以及 side BUY 情况的数量调整
export const preprocessQuote = (query: QueryInterface): QueryInterface => {
  const result = ensureCorrectSymbolCase(query)
  if (typeof query.base === 'string' && query.side === 'BUY') {
    // 用户 BUY base, 手续费就是 base 的 Token，即 order的 makerToken —— 对应做市商转出的币，用户收到的币
    const tokenConfigs: TokenConfig[] = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
    const tokenCfg = getTokenCfg(query.base.toUpperCase(), tokenConfigs)
    const config = updaterStack.markerMakerConfigUpdater.cacheResult
    // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
    const feeFactor = calcFeeFactorWhenBuy(tokenCfg, query.feefactor) || config.feeFactor || 10
    const tokens = getSupportedTokens()
    const found = getToken(query.base.toUpperCase(), tokens)
    if (found) {
      result.amount = applyFeeToAmount(query.amount, feeFactor, found.precision)
      console.debug(
        `convert amount when buy side, amount=${query.amount}, converted=${result.amount}, feeFactor=${feeFactor}`
      )
    }
  }
  return result
}

export function ensureCorrectSymbolCase(
  query: QueryInterface,
  supportedTokens: SupportedToken[] = null
): QueryInterface {
  const tokens = supportedTokens || getSupportedTokens()
  const result = { ...query }
  // query token by address
  if (query.baseAddress && query.quoteAddress) {
    const baseToken = tokens.find(
      (t) => t.contractAddress.toLowerCase() === query.baseAddress.toLowerCase()
    )
    if (baseToken) {
      result.base = baseToken.symbol
      result.baseAddress = baseToken.contractAddress.toLowerCase()
    }
    const quoteToken = tokens.find(
      (t) => t.contractAddress.toLowerCase() === query.quoteAddress.toLowerCase()
    )
    if (quoteToken) {
      result.quote = quoteToken.symbol
      result.quoteAddress = quoteToken.contractAddress.toLowerCase()
    }
  } else {
    if (typeof query.base === 'string') {
      const found = tokens.find((t) => t.symbol.toUpperCase() === query.base.toUpperCase())
      if (found) {
        result.base = found.symbol
        result.baseAddress = found.contractAddress.toLowerCase()
      }
    }
    if (typeof query.quote === 'string') {
      const found = tokens.find((t) => t.symbol.toUpperCase() === query.quote.toUpperCase())
      if (found) {
        result.quote = found.symbol
        result.quoteAddress = found.contractAddress.toLowerCase()
      }
    }
  }
  console.log(
    `ensureCorrectSymbolCase, query=${JSON.stringify(query)}, result=${JSON.stringify(result)}`
  )
  return result
}
