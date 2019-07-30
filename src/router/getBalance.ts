import * as _ from 'lodash'
import { getSupportedTokens } from '../utils/token'
import { getTokenlonTokenBalance } from '../utils/balance'

export const getBalance = async (ctx) => {
  try {
    const tokenList = getSupportedTokens()
    const token = tokenList.find(t => t.symbol.toUpperCase() === ctx.query.token.toUpperCase())

    if (token && token.contractAddress) {
      const balance = await getTokenlonTokenBalance(token)
      ctx.body = {
        result: true,
        balance,
      }
    } else {
      ctx.body = {
        result: false,
        message: `Don't support token ${ctx.query.token} trade`,
      }
    }
  } catch (e) {
    ctx.body = {
      result: false,
      message: e.message,
    }
  }
}