import * as Sentry from '@sentry/node'
import tracker from '../utils/tracker'
import { ExceptionOrder } from '../types'
import { removeQuoteIdPrefix } from '../utils/quoteId'

export const exceptionOrder = async (ctx) => {
  const {
    makerToken,
    takerToken,
    makerTokenAmount,
    takerTokenAmount,
    quoteId,
    timestamp,
    type,
  } = ctx.request.body as ExceptionOrder
  const order = {
    makerToken,
    takerToken,
    makerTokenAmount,
    takerTokenAmount,
    quoteId: removeQuoteIdPrefix(quoteId),
    timestamp,
    type,
  }

  const quoter = ctx.quoter

  let reqToMMErrMsg = null

  tracker.captureEvent({
    message: 'exception order trigger by HTTP',
    level: Sentry.Severity.Log,
    extra: order,
  })

  try {
    const res = await quoter.exceptionOrder(order)
    if (!res.result) {
      reqToMMErrMsg = 'MM exception API not response result true'
    }
  } catch (e) {
    reqToMMErrMsg = e.message
  }

  ctx.body = {
    result: reqToMMErrMsg ? false : true,
    message: reqToMMErrMsg,
  }
}
