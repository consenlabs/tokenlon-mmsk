import * as Sentry from '@sentry/node'
import tracker from '../utils/tracker'
import { dealOrder as dealOrderToMM } from '../request/marketMaker'
import { DealOrder } from '../types'
import { getTimestamp } from '../utils/timestamp'

let notifiedOrders = []

const isNotifiedOrder = (order) => {
  return !!notifiedOrders.find(o => o.quoteId === order.quoteId)
}

const handleNotifiedOrder = (order) => {
  // 只保留一天的成交已通知订单
  notifiedOrders = notifiedOrders.filter(o => o.timestamp >= getTimestamp() - 24 * 60 * 60)
  notifiedOrders.push(order)
}

export const dealOrder = async (ctx) => {
  const { makerToken, takerToken, makerTokenAmount, takerTokenAmount, quoteId, timestamp } = ctx.request.body as DealOrder
  const order = { makerToken, takerToken, makerTokenAmount, takerTokenAmount, quoteId, timestamp }

  tracker.captureEvent({
    message: 'userDeal trigger by HTTP',
    level: Sentry.Severity.Log,
    extra: order,
  })

  if (!isNotifiedOrder(order)) {
    dealOrderToMM(order)
    handleNotifiedOrder(order)

  } else {
    tracker.captureMessage('order alread notified', Sentry.Severity.Info)
  }

  ctx.body = {
    result: true,
  }
}