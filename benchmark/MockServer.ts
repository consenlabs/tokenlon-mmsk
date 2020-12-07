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
      pairs: ['DAI/ETH'],
    }
  })
  router.get('/indicativePrice', function (ctx, _next) {
    ctx.body = {
      result: true,
      exchangeable: true,
      price: 0.00017508,
      minAmount: 0.002,
      maxAmount: 100,
    }
  })
  router.get('/price', function (ctx, _next) {
    ctx.body = {
      result: true,
      exchangeable: true,
      price: 0.00017508,
      minAmount: 0.0002,
      maxAmount: 100,
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
      tokenlonExchangeContractAddress: '0xD489f1684CF5e78D933E254BD7AC8A9A6a70d491',
      wethContractAddress: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
      userProxyContractAddress: '0x25657705a6be20511687D483f2fCCfb2d92f6033',
      orderExpirationSeconds: 600,
      mmProxyContractAddress: '',
      feeFactor: 30,
      addressBookV5: {
        Tokenlon: '0xA9eedf0130963C4204D15c95a870E49E64feE8BE',
        PMM: '0x3346CCe684E7f93DfCcbB9bFC4942791d75B766D',
        AllowanceTarget: '0x4e033fbc27Bd9f4A0e503640BCEc0319044d0717',
        AMMQuoter: '0x71a951c6D01911552373b77B4946b86e1F664013',
        AMMWrapper: '0xC824f36da1e6F5E8D411A4176BEFe1bDe5568BAa',
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
        contractAddress: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.1,
        maxTradeAmount: 1e1,
      },
      {
        symbol: 'DAI',
        contractAddress: '0x5c964665b6379527b625be996020d861f27aa31d',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.001,
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
