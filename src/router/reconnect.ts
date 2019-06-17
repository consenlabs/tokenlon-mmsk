import * as Sentry from '@sentry/node'
import StompForExchange from '../utils/stomp'
import tracker from '../utils/tracker'

export const reconnect = (ctx, stompForExchange: StompForExchange) => {
  const { reconnect } = ctx.request.body

  if (reconnect === true) {
    if (!stompForExchange.connecting && !stompForExchange.connected && stompForExchange.isTriedMaxTimes()) {
      stompForExchange.resetTriedTimes()
      stompForExchange.connectStomp()
      tracker.captureMessage('reconnect: try', Sentry.Severity.Critical)
      ctx.body = {
        result: true,
        message: 'try connecting',
      }
    } else {
      tracker.captureMessage('reconnect: already connecting or trying to connect or connected', Sentry.Severity.Info)
      ctx.body = {
        result: true,
        message: 'already connecting or trying to connect or connected',
      }
    }
  } else {
    tracker.captureMessage('params reconnect need to be true', Sentry.Severity.Error)
    ctx.body = {
      result: false,
      message: 'params reconnect need to be true',
    }
  }
}