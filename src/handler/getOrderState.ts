import { getOrderStateForMM } from '../request/imToken'
import { addQuoteIdPrefix, removeQuoteIdPrefix } from '../quoting'

export const getOrderState = async (ctx) => {
  try {
    const order = await getOrderStateForMM(addQuoteIdPrefix(ctx.query.quoteId))
    if (order.quoteId) {
      order.quoteId = removeQuoteIdPrefix(order.quoteId)
    }
    ctx.body = {
      result: true,
      order,
    }
  } catch (e) {
    ctx.body = {
      result: false,
      message: e.message,
    }
  }
}
