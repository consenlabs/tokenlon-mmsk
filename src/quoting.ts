import { isNil } from 'lodash'
import { QueryInterface, SIDE, SupportedToken } from './types'
import { IndicativePriceApiResult } from './request/marketMaker'
import { BackendError } from './handler/errors'
import { updaterStack } from './worker'
import { truncateAmount, toBN, getSupportedTokens } from './utils'

const getPrefix = (): string => `${updaterStack.markerMakerConfigUpdater.cacheResult.mmId}--`

export const addQuoteIdPrefix = (quoteId: string): string => `${getPrefix()}${quoteId}`

export const removeQuoteIdPrefix = (quoteId: string): string => {
  const prefix = getPrefix()
  if (quoteId.startsWith(prefix)) return quoteId.replace(prefix, '')
  return quoteId
}

export const constructQuoteResponse = (indicativePrice: IndicativePriceApiResult, side: SIDE) => {
  const { minAmount, maxAmount, message, makerAddress } = indicativePrice
  if (indicativePrice.exchangeable === false || !indicativePrice.price) {
    throw new BackendError(
      message || `Can't support this trade: ${JSON.stringify(indicativePrice)}`
    )
  }

  const rate = side === 'BUY' ? 1 / indicativePrice.price : indicativePrice.price
  return {
    minAmount,
    maxAmount,
    rate: toBN((+rate).toFixed(8)).toNumber(), // NOTE: number process
    makerAddress,
  }
}

// Process buy amount for WYSIWY
function applyFeeToAmount(amount: number, feeFactor: number) {
  if (isNil(amount)) return amount
  return truncateAmount(+amount / (1 - feeFactor / 10000), 6) // NOTE: number process
}

function calcFeeFactorWhenBuy(baseSymbol: string, factor: number | null): number {
  const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
  // 用户 BUY base, 手续费就是 base 的 Token，即 order的 makerToken —— 对应做市商转出的币，用户收到的币
  // 但是，Token Config 返回的配置是 feeFactor
  const foundTokenConfig = tokenConfigs.find((t) => t.symbol.toUpperCase() === baseSymbol)
  const config = updaterStack.markerMakerConfigUpdater.cacheResult

  const queryFeeFactor = Number(factor)
  if (!isNaN(queryFeeFactor) && queryFeeFactor >= 0) {
    return queryFeeFactor
  } else if (foundTokenConfig && foundTokenConfig.feeFactor) {
    return foundTokenConfig.feeFactor
  }
  return config.feeFactor || 0
}

// 处理接口大小写情况，转换为系统设定格式，以及 side BUY 情况的数量调整
export const translateQueryData = (query: QueryInterface): QueryInterface => {
  const result = { ...query }

  if (typeof query.base === 'string' && query.side === 'BUY') {
    // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
    // Token Config 返回的配置是 feeFactor
    const feeFactor = calcFeeFactorWhenBuy(query.base.toUpperCase(), query.feefactor)
    result.amount = applyFeeToAmount(query.amount, feeFactor)
    console.debug(
      `convert amount when buy side, amount=${query.amount}, converted=${result.amount}, feeFactor=${feeFactor}`
    )
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
