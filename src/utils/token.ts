import { memoize } from 'lodash'
import { updaterStack } from '../worker'
import { SupportedToken, Token } from '../types'

const helper = (stack, token1, token2) => {
  if (stack[token1] && stack[token1].indexOf(token2) === -1) {
    stack[token1].push(token2)
  } else if (!stack[token1]) {
    stack[token1] = [token2]
  }
}

/**
 * ['SNT/ETH', 'SNT/TUSD'] =>
 * {
 *   SNT: ['ETH', 'TUSD']
 *   ETH: ['SNT']
 *   TUSD: ['SNT']
 * }
 */
const _transferPairStrArrToTokenStack = (key: string, pairStrArr) => {
  const stack = {}
  if (!key) {
    return stack
  }
  if (!Array.isArray(pairStrArr)) {
    return stack
  }
  pairStrArr.forEach((pairStr) => {
    const [tokenA, tokenB] = pairStr.split('/')
    helper(stack, tokenA, tokenB)
    helper(stack, tokenB, tokenA)
  })
  return stack
}

const transferPairStrArrToTokenStack = memoize(_transferPairStrArrToTokenStack)

const _mapTokens = (key: string, {
  tokenList,
  tokenStack
}) => {
  if (!key) {
    return []
  }
  const result = []
  for (const token of tokenList) {
    const { symbol } = token
    const opposites = tokenStack[symbol]
    if (opposites && opposites.length) {
      const oppositeTokens: Token[] = []
      opposites.filter((symbol) => {
        const token = getTokenBySymbol(tokenList, symbol)
        if (token) {
          oppositeTokens.push(token)
        }
      })
      result.push({
        ...token,
        opposites: oppositeTokens,
      })
    }
  }
  return result
}

const mapTokens = memoize(_mapTokens)

export const getSupportedTokens = (): SupportedToken[] => {
  const { tokenListFromImtokenUpdater, pairsFromMMUpdater } = updaterStack
  if (
    !Array.isArray(pairsFromMMUpdater.cacheResult) ||
    !Array.isArray(tokenListFromImtokenUpdater.cacheResult)
  ) {
    return []
  }
  const tokenStack = transferPairStrArrToTokenStack(
    JSON.stringify(pairsFromMMUpdater.cacheResult),
    pairsFromMMUpdater.cacheResult
  )
  const tokenList: Token[] = tokenListFromImtokenUpdater.cacheResult
  const lists = {
    tokenList: tokenList,
    tokenStack: tokenStack
  }
  return mapTokens(
    JSON.stringify(lists),
    lists
  )
}

export const isSupportedBaseQuote = (
  tokens: SupportedToken[],
  base: string,
  quote: string
): boolean => {
  return tokens.some((t) => {
    const ops = t.opposites.map((o) => o.symbol.toUpperCase())
    return t.symbol.toUpperCase() === base.toUpperCase() && ops.indexOf(quote.toUpperCase()) !== -1
  })
}

export const getTokenBySymbol = (tokens, symbol) => {
  return tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase())
}

export const getTokenByAddress = (tokens, address) => {
  return tokens.find((t) => t.contractAddress.toLowerCase() === address.toLowerCase())
}
