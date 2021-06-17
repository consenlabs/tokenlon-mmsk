import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as BodyParser from 'koa-bodyparser'
import * as logger from 'koa-logger'
import * as JsonRPC from '@koalex/koa-json-rpc'

function makeMarketMakerRounter(): Router {
  const router = new Router()
  router.get('/pairs', function (ctx, _next) {
    ctx.body = {
      result: true,
      pairs: ['DAI/ETH', 'USDT/ETH'],
    }
  })
  router.get('/indicativePrice', function (ctx, _next) {
    ctx.body = {
      result: true,
      exchangeable: true,
      price: 0.01,
      minAmount: 0.002,
      maxAmount: 100,
    }
  })
  router.get('/price', function (ctx, _next) {
    ctx.body = {
      result: true,
      exchangeable: true,
      price: 222,
      minAmount: 0.0002,
      maxAmount: 500,
      quoteId: 'asfadsf-dsfsdf-ggsd-qwe-rgjty',
    }
  })
  router.get('/deal', function (ctx, _next) {
    ctx.body = { result: true }
  })
  return router
}

function createRPCHandler(): JsonRPC {
  const endpoint = new JsonRPC({
    bodyParser: BodyParser({
      onerror: (_err, ctx) => {
        ctx.status = 200
        ctx.body = JsonRPC.parseError
      },
    }),
  })
  endpoint.method('tokenlon.getMarketMakerConfig', (ctx, _next) => {
    // test address on kovan network
    ctx.body = {
      mmId: 1,
      networkId: 3000,
      erc20ProxyContractAddress: '0xf1ec01d6236d3cd881a0bf0130ea25fe4234003e',
      exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b',
      forwarderContractAddress: '0xd85e2fa7e7e252b27b01bf0d65c946959d2f45b8',
      zrxContractAddress: '0x2002d3812f58e35f0ea1ffbf80a75a38c32175fa',
      tokenlonExchangeContractAddress: '0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491',
      wethContractAddress: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
      userProxyContractAddress: '0x25657705a6be20511687D483f2fCCfb2d92f6033',
      orderExpirationSeconds: 600,
      mmProxyContractAddress: '0xd7Fe4409973a032a4B19E3b4aE3C2B6E6559D12E',
      feeFactor: 30,
      addressBookV5: {
        Tokenlon: '0x4A234aA24A1911Fa256162Dd34395B676f5DbdA6',
        PMM: '0xD6ec1bAd089241207C640CaE45Fec5576C3D72d5',
        AllowanceTarget: '0x6F1eE33E23a33Ef690C6C0CD9B7Dc4a666e072E5',
        AMMQuoter: '0x75a4f88deeed0ace489285d1695323ef49dbc2ab',
        AMMWrapper: '0xcf011536f10e85e376e70905eed4ca9ea8cded34',
        RFQ: '0xfD474E4809e690626C67ECb7A908de4b9c464b99',
      },
    }
  })
  endpoint.method('auth.getMMJwtToken', (ctx, _next) => {
    ctx.body = 'TODO'
  })

  endpoint.method('tokenlon.getTokenList', (ctx, _next) => {
    ctx.body = [
      {
        symbol: 'ETH',
        contractAddress: '0x0000000000000000000000000000000000000000',
        decimal: 18,
        precision: 6,
        minTradeAmount: 1e-7,
        maxTradeAmount: 1e1,
      },
      {
        symbol: 'WETH',
        contractAddress: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.1,
        maxTradeAmount: 1e1,
      },
      {
        symbol: 'LON',
        contractAddress: '0x6dA0e6ABd44175f50C563cd8b860DD988A7C3433',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.001,
        maxTradeAmount: 1e4,
      },
      {
        symbol: 'UNI',
        contractAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.001,
        maxTradeAmount: 1e4,
      },
      {
        symbol: 'USDT',
        contractAddress: '0xa93Ef9215b907c19e739E2214e1AA5412a0401B5',
        decimal: 6,
        precision: 4,
        minTradeAmount: 5,
        maxTradeAmount: 1e4,
      },
    ]
  })

  endpoint.method('tokenlon.getTokenConfigsForMM', (ctx, _next) => {
    ctx.body = [
      {
        symbol: 'ETH',
        feeFactor: 30,
      },
      {
        symbol: 'DAI',
        feeFactor: 30,
      },
      {
        symbol: 'UNI',
        feeFactor: 30,
      },
      {
        symbol: 'USDT',
        feeFactor: 30,
      },
    ]
  })

  endpoint.method('tokenlon.getOrdersHistoryForMM', (ctx, _next) => {
    ctx.body = 'TODO'
  })

  endpoint.method('tokenlon.getOrderStateForMM', (ctx, _next) => {
    ctx.body = 'TODO'
  })

  endpoint.method('hello', (ctx, _next) => {
    // ctx.jsonrpc available
    /*
        ctx.jsonrpc.request
        ctx.jsonrpc.id
        ctx.jsonrpc.method [[Get]]
        ctx.jsonrpc.params [[Get]]
        ctx.jsonrpc.response
        ctx.jsonrpc.result
        ctx.jsonrpc.error
        ctx.jsonrpc.code
        ctx.jsonrpc.message
        ctx.jsonrpc.data
    */
    ctx.body = 'Hello world!'
  })

  return endpoint
}

const app = new Koa()
const router = makeMarketMakerRounter()
router.post('/rpc', createRPCHandler().middleware)
app.use(BodyParser()).use(logger()).use(router.routes()).use(router.allowedMethods())
app.listen(8088)
