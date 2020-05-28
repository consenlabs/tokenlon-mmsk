import 'babel-polyfill'
import * as Sentry from '@sentry/node'
import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as Bodyparser from 'koa-bodyparser'
import { getRate, newOrder, getSupportedTokenList, getBalances, getBalance, getOrderState, getOrdersHistory, dealOrder, exceptionOrder, version } from './router'
import { setConfig } from './config'
import { ConfigForStart } from './types'
import { startUpdater } from './utils/intervalUpdater'
import { getWallet } from './utils/wallet'
import { connectClient } from './request/marketMaker/zerorpc'
import { isValidWallet } from './validations'
import tracker from './utils/tracker'

const app = new Koa()
const router = new Router()

const beforeStart = async (config: ConfigForStart, triedTimes?: number) => {
  const wallet = getWallet()
  triedTimes = triedTimes || 0
  try {
    if (config.USE_ZERORPC) {
      connectClient(config.ZERORPC_SERVER_ENDPOINT)
    }

    await startUpdater(wallet)

  } catch (e) {
    triedTimes += 1
    tracker.captureException(e)
    tracker.captureEvent({
      message: `mmsk before start program faild`,
      level: Sentry.Severity.Warning,
      extra: {
        triedTimes,
      },
    })

    if (triedTimes > 10) {
      delete config.WALLET_ADDRESS
      delete config.WALLET_KEYSTORE
      delete config.WALLET_PRIVATE_KEY
      tracker.captureEvent({
        message: `need to check config (except wallet address, keystore or privateKey)`,
        level: Sentry.Severity.Fatal,
        extra: config,
      })
      throw e
    }

    beforeStart(config, triedTimes)
  }
}

export const startMMSK = async (config: ConfigForStart) => {
  // default 80
  const MMSK_SERVER_PORT = config.MMSK_SERVER_PORT || 80

  setConfig(config)

  try {
    const wallet = getWallet()
    if (!isValidWallet(wallet)) {
      throw `wallet's address and ${config.USE_KEYSTORE ? 'keystore' : 'privateKey'} not matched`
    }

    // init sentry
    tracker.init({ SENTRY_DSN: config.SENTRY_DSN, NODE_ENV: config.NODE_ENV })

    await beforeStart(config)

    // for imToken server
    router.get('/getRate', getRate)
    router.get('/newOrder', newOrder)
    router.get('/version', version)
    router.get('/getSupportedTokenList', getSupportedTokenList)
    router.post('/dealOrder', dealOrder)
    router.post('/exceptionOrder', exceptionOrder)

    // for market maker
    router.get('/getOrderState', getOrderState)
    router.get('/getOrdersHistory', getOrdersHistory)
    router.get('/getBalance', getBalance)
    router.get('/getBalances', getBalances)

    app
      .use(async (ctx, next) => {
        ctx.set('Strict-Transport-Security', 'max-age=2592000; includeSubDomains; preload')
        ctx.set('X-Content-Type-Option', 'nosniff')
        ctx.set('X-Frame-Options', 'SAMEORIGIN')
        ctx.set('X-XSS-Protection', '1; mode=block')
        await next()
      })
      .use(Bodyparser())
      .use(router.routes())
      .use(router.allowedMethods())

    app.on('error', err => {
      tracker.captureEvent({
        message: 'app onerror',
        level: Sentry.Severity.Warning,
        extra: err,
      })
    })

    app.listen(MMSK_SERVER_PORT)

    console.log(`app listen on ${MMSK_SERVER_PORT}`)

  } catch (e) {
    console.log(e)
    process.exit(0)
  }
}