import { getSupportedTokens } from '../utils/token'
import { getTokenlonTokenBalance } from '../utils/balance'

export const getBalances = async (ctx) => {
  try {
    const tokenList = getSupportedTokens()
    const balances = await Promise.all(
      tokenList.map(async (token) => {
        const balance = await getTokenlonTokenBalance(token)
        return {
          symbol: token.symbol,
          balance,
        }
      })
    )

    ctx.body = {
      result: true,
      balances,
    }
  } catch (e) {
    ctx.body = {
      result: true,
      message: e.message,
    }
  }
}
