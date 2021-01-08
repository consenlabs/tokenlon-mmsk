import * as Sentry from '@sentry/node'
import tracker from '../utils/tracker'
import { DealOrder } from '../types'
import { removeQuoteIdPrefix } from '../quoting'

export const dealOrder = async (ctx) => {
  const { makerToken, takerToken, makerTokenAmount, takerTokenAmount, quoteId, timestamp } = ctx
    .request.body as DealOrder
  const order = {
    makerToken,
    takerToken,
    makerTokenAmount,
    takerTokenAmount,
    quoteId: removeQuoteIdPrefix(quoteId),
    timestamp,
  }
  let reqToMMErrMsg = null

  tracker.captureEvent({
    message: 'userDeal trigger by HTTP',
    level: Sentry.Severity.Log,
    extra: order,
  })

  try {
    const res = await ctx.quoter.dealOrder(order)
    if (!res.result) {
      reqToMMErrMsg = 'MM deal API not response result true'
    }
  } catch (e) {
    reqToMMErrMsg = e.message
  }

  ctx.body = {
    result: reqToMMErrMsg ? false : true,
    message: reqToMMErrMsg,
  }
}
