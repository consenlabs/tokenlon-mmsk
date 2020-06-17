import * as _ from 'lodash'
import { updaterStack } from '../utils/intervalUpdater'
import { roundAmount } from './format'
import { QueryInterface } from '../router/interface'
import { getSupportedTokens } from './token'

export const leftPadWith0 = (str, len) => {
  str = str + ''
  len = len - str.length
  if (len <= 0) return str
  return '0'.repeat(len) + str
}

// 处理接口大小写情况，转换为系统设定格式，以及 side BUY 情况的数量调整
export const translateQueryData = (query: QueryInterface): QueryInterface => {
  const tokens = getSupportedTokens()
  let updatedBase = null
  let updatedQuote = null
  let updatedAmount = null

  if (_.isString(query.base)) {
    const found = tokens.find(t => t.symbol.toUpperCase() === query.base.toUpperCase())
    if (found) {
      updatedBase = found.symbol
    }

    const { amount, side } = query

    if (side === 'BUY') {
      const config = updaterStack.markerMakerConfigUpdater.cacheResult
      const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
      // 注意：query 上，后端传递的是 feefactor，而不是 feeFactor
      // 但是，Token Config 返回的配置是 feeFactor
      const queryFeeFactor = query.feefactor
      // 用户 BUY base, 手续费就是 base 的 Token，即 order的 makerToken —— 对应做市商转出的币，用户收到的币
      const foundTokenConfig = tokenConfigs.find(t => t.symbol.toUpperCase() === query.base.toUpperCase())
      const feeFactor = !_.isUndefined(queryFeeFactor) && !_.isNaN(+queryFeeFactor) && +queryFeeFactor >= 0 ? +queryFeeFactor : (
        foundTokenConfig && foundTokenConfig.feeFactor ? foundTokenConfig.feeFactor : (config.feeFactor ? config.feeFactor : 0)
      )
      updatedAmount = amount ? roundAmount(+amount / (1 - feeFactor / 10000), 4) : amount
    }
  }
  if (_.isString(query.quote)) {
    const found = tokens.find(t => t.symbol.toUpperCase() === query.quote.toUpperCase())
    if (found) {
      updatedQuote = found.symbol
    }
  }

  const result = { ...query }

  Object.entries({
    base: updatedBase,
    quote: updatedQuote,
    amount: updatedAmount,
  }).forEach(([key, value]) => {
    if (value) {
      Object.assign(result, {
        [key]: value,
      })
    }
  })

  return result
}