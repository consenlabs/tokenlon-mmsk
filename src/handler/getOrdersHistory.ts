import { getOrdersHistoryForMM } from '../request/imToken'
import { getWallet } from '../config'
import { removeQuoteIdPrefix } from '../utils/quoteId'

export const getOrdersHistory = async (ctx) => {
  const wallet = getWallet()
  try {
    const orders = await getOrdersHistoryForMM({
      ...ctx.query,
      signerAddr: wallet.address,
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
