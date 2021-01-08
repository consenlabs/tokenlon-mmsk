import { getSupportedTokens, getTokenlonTokenBalance } from '../utils'

export const getBalance = async (ctx) => {
  const { query } = ctx
  try {
    const tokenList = getSupportedTokens()
    const token = query.token
      ? tokenList.find((t) => t.symbol.toUpperCase() === query.token.toUpperCase())
      : null

    if (token && token.contractAddress) {
      const balance = await getTokenlonTokenBalance(token)
      ctx.body = {
        result: true,
        balance,
      }
    } else {
      ctx.body = {
        result: false,
        message: `Don't support token ${query.token} trade`,
      }
    }
  } catch (e) {
    ctx.body = {
      result: false,
      message: e.message,
    }
  }
}
