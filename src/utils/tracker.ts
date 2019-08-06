import * as Sentry from '@sentry/node'

let enabled = false
let isProd = false

export const initSentry = ({ SENTRY_DSN, NODE_ENV }) => {
  Sentry.init({ dsn: SENTRY_DSN, environment: NODE_ENV ? NODE_ENV.toLowerCase() : 'development' })
}

export const init = ({ SENTRY_DSN, NODE_ENV }) => {
  enabled = SENTRY_DSN && SENTRY_DSN.indexOf('https') !== -1 && NODE_ENV && ['DEVELOPMENT', 'STAGING', 'PRODUCTION'].includes(NODE_ENV)
  isProd = 'PRODUCTION' === NODE_ENV
  if (enabled) {
    initSentry({ SENTRY_DSN, NODE_ENV })
  }
}

export const captureMessage = (message: string, level?: Sentry.Severity) => {
  if (enabled) {
    Sentry.captureMessage(message, level)
  }

  if (!enabled || (enabled && isProd)) {
    console.log(message, level)
  }
}

export const captureException = (error: Error) => {
  if (enabled) {
    Sentry.captureException(error)
  }

  if (!enabled || (enabled && isProd)) {
    console.log(error)
  }
}

export const captureEvent = (options: Sentry.SentryEvent) => {
  if (enabled) {
    Sentry.captureEvent(options)
  }

  if (!enabled || (enabled && isProd)) {
    console.log(options)
  }
}

export default {
  init,
  captureEvent,
  captureMessage,
  captureException,
}
