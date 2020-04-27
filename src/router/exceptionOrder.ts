import * as Sentry from '@sentry/node'
import tracker from '../utils/tracker'
import { exceptionOrder as exceptionOrderToMM } from '../request/marketMaker'
import { ExceptionOrder } from '../types'
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

export const exceptionOrder = async (ctx) => {
  const { makerToken, takerToken, makerTokenAmount, takerTokenAmount, quoteId, timestamp, type } = ctx.request.body as ExceptionOrder
  const order = { makerToken, takerToken, makerTokenAmount, takerTokenAmount, quoteId, timestamp, type }

  let reqToMMErrMsg = null

  tracker.captureEvent({
    message: 'exception order trigger by HTTP',
    level: Sentry.Severity.Log,
    extra: order,
  })

  if (!isNotifiedOrder(order)) {
    try {
      const res = await exceptionOrderToMM(order)
      if (!res.result) {
        reqToMMErrMsg = 'MM exception API not response result true'
      }
    } catch (e) {
      reqToMMErrMsg = e.message
    }

    handleNotifiedOrder(order)

  } else {
    tracker.captureMessage('exception order alread notified', Sentry.Severity.Info)
  }

  ctx.body = {
    result: reqToMMErrMsg ? false : true,
    message: reqToMMErrMsg,
  }
}