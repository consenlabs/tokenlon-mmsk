import 'babel-polyfill'
import * as Sentry from '@sentry/node'
import * as Koa from 'koa' // TODO: replace to express, for better logging support
import * as Router from 'koa-router'
import * as Bodyparser from 'koa-bodyparser'
import * as logger from 'koa-logger'
import {
  getRate,
  newOrder,
  getSupportedTokenList,
  getBalances,
  getBalance,
  getOrderState,
  getOrdersHistory,
  dealOrder,
  exceptionOrder,
  version,
  signOrder,
} from './handler'
import { setConfig, getWallet } from './config'
import { ConfigForStart } from './types'
import { startUpdater } from './worker'
import { QuoteDispatcher, QuoterProtocol } from './request/marketMaker'
import tracker from './utils/tracker'
import { Quoter } from './request/marketMaker/types'
import { PermitType, WalletType } from './signer/types'
import { VERSION } from './handler/version'

// FIXME: construct wallet(signer), quoter and worker separately
// FIXME: better retry implementation
const beforeStart = async (config: ConfigForStart, triedTimes?: number) => {
  // const wallet = getWallet()
  triedTimes = triedTimes || 0
  try {
    let quoter: Quoter
    if (config.EXTERNAL_QUOTER) {
      quoter = config.EXTERNAL_QUOTER
    } else {
      quoter = new QuoteDispatcher(config.HTTP_SERVER_ENDPOINT, QuoterProtocol.HTTP)
    }
    await startUpdater(quoter, config.WALLET_ADDRESS)
    return quoter
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
  const app = new Koa()
  const router = new Router()
  const MMSK_SERVER_PORT = config.MMSK_SERVER_PORT || 80
  let wallet
  setConfig(config)
  try {
    console.log(config.SIGNING_URL)
    if (!config.SIGNING_URL && config.AMM_ONLY !== 'true') {
      wallet = await getWallet()
      if (!wallet) {
        throw new Error(`Please set either WALLET_PRIVATE_KEY or SIGNING_URL`)
      }
      const walletAddress = await wallet.getAddress()
      if (walletAddress.toLowerCase() != config.WALLET_ADDRESS.toLowerCase()) {
        throw `wallet's address${wallet.address} and ${
          config.USE_KEYSTORE ? 'keystore' : 'privateKey'
        }(${config.WALLET_ADDRESS}) not matched`
      }
    }
    console.log({
      version: VERSION,
      signerAddress: config.WALLET_ADDRESS,
      mmpType: config.WALLET_TYPE || WalletType.MMP_VERSION_4,
      permitType: config.PERMIT_TYPE || PermitType.ALLOWANCE_TARGET,
      chainId: config.CHAIN_ID,
      exchangeUrl: config.EXCHANGE_URL,
      signingUrl: config.SIGNING_URL,
    })

    // init sentry
    tracker.init({ SENTRY_DSN: config.SENTRY_DSN, NODE_ENV: config.NODE_ENV })

    const quoter = await beforeStart(config)

    // Respond to Tokenlon quoting server
    router.get('/getRate', getRate)
    router.post('/signOrder', signOrder)
    router.get('/newOrder', newOrder)
    router.get('/version', version)
    router.get('/getSupportedTokenList', getSupportedTokenList)
    router.post('/dealOrder', dealOrder)
    router.post('/exceptionOrder', exceptionOrder)
    // Respond to market maker backend
    router.get('/getOrderState', getOrderState)
    router.get('/getOrdersHistory', getOrdersHistory)
    router.get('/getBalance', getBalance)
    router.get('/getBalances', getBalances)

    app.context.chainID = config.CHAIN_ID || 5
    app.context.quoter = quoter
    if (wallet) {
      app.context.signer = wallet
    }
    if (config.SIGNING_URL) {
      app.context.signingUrl = config.SIGNING_URL
    }
    app.context.walletType = config.WALLET_TYPE || WalletType.MMP_VERSION_4
    app.context.permitType = config.PERMIT_TYPE || PermitType.ALLOWANCE_TARGET

    app
      .use(async (ctx, next) => {
        ctx.set('Strict-Transport-Security', 'max-age=2592000; includeSubDomains; preload')
        ctx.set('X-Content-Type-Option', 'nosniff')
        ctx.set('X-Frame-Options', 'SAMEORIGIN')
        ctx.set('X-XSS-Protection', '1; mode=block')
        await next()
      })
      .use(Bodyparser())
      .use(
        logger((_str, args) => {
          if (args.length > 3) {
            // dont log inbound request
            args.shift(0)
            args.unshift('INFO')
            args.unshift(new Date().toISOString())
            console.log(args.join(' '))
          }
        })
      )
      .use(router.routes())
      .use(router.allowedMethods())

    app.on('error', (err) => {
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
