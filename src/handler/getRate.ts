import { validateRequest } from '../validations'
import { ValidationError } from './errors'
import { constructQuoteResponse, preprocessQuote } from '../quoting'

export const getRate = async (ctx) => {
  const { query, quoter } = ctx
  try {
    const updatedQueryData = preprocessQuote(query)
    const errMsg = validateRequest(updatedQueryData)
    if (errMsg) throw new ValidationError(errMsg)

    const { side } = updatedQueryData
    const quoteResult = await quoter.getIndicativePrice(updatedQueryData)
    const quoteResponse = constructQuoteResponse(quoteResult, side)
    ctx.body = {
      result: true,
      exchangeable: true,
      ...quoteResponse,
    }
  } catch (e) {
    console.error(e.stack)
    ctx.body = {
      result: false,
      exchangeable: false,
      message: e.message,
    }
  }
}
