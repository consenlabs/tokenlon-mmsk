import { getSupportedTokens } from '../utils/token'

const check = async (quoter) => {
  try {
    const tokenA = getSupportedTokens()[0]
    const mockOrder = {
      makerToken: tokenA.symbol,
      makerTokenAmount: 0.1,
      takerToken: tokenA.opposites[0],
      takerTokenAmount: 50,
      timestamp: 1551855180,
      quoteId: 'testing-quote-9999',
    }
    const resp = await quoter.dealOrder(mockOrder)
    if (resp.result !== false) {
      return `deal an non-exist order ${JSON.stringify(mockOrder)} but got result not false`
    }
  } catch (e) {
    return `deal API request error ${e.message}`
  }
  return ''
}

export default check
