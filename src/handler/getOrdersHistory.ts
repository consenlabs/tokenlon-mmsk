import { getOrdersHistoryForMM } from '../request/imToken'
import { removeQuoteIdPrefix } from '../utils/quoteId'

export const getOrdersHistory = async (ctx) => {
  try {
    const orders = await getOrdersHistoryForMM({
      ...ctx.query,
      signerAddr: ctx.signer.address,
    })
    orders.forEach((order) => {
      if (order.quoteId) {
        order.quoteId = removeQuoteIdPrefix(order.quoteId)
      }
    })
    ctx.body = {
      result: true,
      orders,
    }
  } catch (e) {
    ctx.body = {
      result: false,
      message: e.message,
    }
  }
}
