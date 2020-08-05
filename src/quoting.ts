import { Protocol, QueryInterface, SIDE, SupportedToken } from './types'
import { IndicativePriceApiResult, PriceApiResult } from './request/marketMaker/types'
import { BackendError } from './handler/errors'
import { toBN } from './utils/math'
import { addQuoteIdPrefix } from './utils/quoteId'
import { roundAmount } from './utils/format'
import { updaterStack } from './worker'
import { getSupportedTokens } from './utils/token'

export const constructQuoteResponse = (priceResult: IndicativePriceApiResult, side: SIDE) => {
  const { minAmount, maxAmount, message } = priceResult
  if (priceResult.exchangeable === false || !priceResult.price) {
    throw new BackendError(message || "Can't support this trade")
  }

  const rate = side === 'BUY' ? 1 / priceResult.price : priceResult.price
  return {
    minAmount,
    maxAmount,
    rate: toBN((+rate).toFixed(8)).toNumber(),
  }
}

export const appendQuoteIdToQuoteReponse = (priceResult: PriceApiResult, side: SIDE) => {
  const rateBody = constructQuoteResponse(priceResult, side)
  return {
    ...rateBody,
    quoteId: addQuoteIdPrefix(priceResult.quoteId),
  }
}

function applyFeeToAmount(amount: number, feeFactor: number) {
  return amount ? roundAmount(+amount / (1 - feeFactor / 10000), 4) : amount
}

function calculateFeeFactor(baseSymbol: string, factor: number | null): number {
  const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
  // 用户 BUY base, 手续费就是 base 的 Token，即 order的 makerToken —— 对应做市商转出的币，用户收到的币
  // 但是，Token Config 返回的配置是 feeFactor
  const foundTokenConfig = tokenConfigs.find((t) => t.symbol.toUpperCase() === baseSymbol)

  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  let result = config.feeFactor ? config.feeFactor : 0

  const queryFeeFactor = Number(factor)
  if (!isNaN(queryFeeFactor) && queryFeeFactor >= 0) {
    result = queryFeeFactor
  } else if (foundTokenConfig && foundTokenConfig.feeFactor) {
    result = foundTokenConfig.feeFactor
  }
  return result
}

function processBuyAmount(query: QueryInterface): QueryInterface {
  const result = { ...query }
  // TODO: process fee on v3 later
  if (query.protocol == Protocol.ZeroXV3) {
    return result
  }

  if (typeof query.base === 'string' && query.side === 'BUY') {
    // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
    // Token Config 返回的配置是 feeFactor
    const feefactor = calculateFeeFactor(query.base.toUpperCase(), query.feefactor)
    result.amount = applyFeeToAmount(query.amount, feefactor)
  }
  return result
}

export function ensureCorrectSymbolCase(
  query: QueryInterface,
  supportedTokens: SupportedToken[] = null
): QueryInterface {
  const tokens = supportedTokens || getSupportedTokens()
  const result = { ...query }

  if (typeof query.base === 'string') {
    const found = tokens.find((t) => t.symbol.toUpperCase() === query.base.toUpperCase())
    if (found) {
      result.base = found.symbol
    }
  }
  if (typeof query.quote === 'string') {
    const found = tokens.find((t) => t.symbol.toUpperCase() === query.quote.toUpperCase())
    if (found) {
      result.quote = found.symbol
    }
  }
  return result
}

// 处理接口大小写情况，转换为系统设定格式，以及 side BUY 情况的数量调整
export const translateQueryData = (query: QueryInterface): QueryInterface => {
  return processBuyAmount(ensureCorrectSymbolCase(query))
}
