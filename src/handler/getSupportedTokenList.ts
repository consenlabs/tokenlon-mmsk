import { getSupportedTokens } from '../utils'

export const getSupportedTokenList = (ctx) => {
  const tokenList = getSupportedTokens()
  ctx.body = {
    result: true,
    tokens: tokenList.map(({ symbol, opposites }) => {
      // To be compatible with current tokenlon api
      const oppositeSymbols = opposites.map((token) => token.symbol)
      return { symbol, opposites: oppositeSymbols }
    }),
  }
}
