import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as BodyParser from 'koa-bodyparser'
import * as logger from 'koa-logger'
import * as JsonRPC from '@koalex/koa-json-rpc'

function makeMarketMakerRounter(): Router {
  const router = new Router()
  router.get('/pairs', function(ctx, _next) {
    ctx.body = {
      'result': true,
      'pairs': [
        'DAI/ETH',
      ],
    }
  })
  router.get('/indicativePrice', function(ctx, _next) {
    ctx.body = {
      'result': true,
      'exchangeable': true,
      'price': 0.00017508,
      'minAmount': 0.002,
      'maxAmount': 100,
    }
  })
  router.get('/price', function(ctx, _next) {
    ctx.body = {
      'result': true,
      'exchangeable': true,
      'price': 0.00017508,
      'minAmount': 0.0002,
      'maxAmount': 100,
      'quoteId': 'asfadsf-dsfsdf-ggsd-qwe-rgjty',
    }
  })
  router.get('/deal', function(ctx, _next) {
    ctx.body = { result: true }
  })
  return router
}

function createRPCHandler(): JsonRPC {
  const endpoint = new JsonRPC({
    bodyParser: BodyParser({
      onerror: (_err, ctx) => {
        ctx.status = 200;
        ctx.body = JsonRPC.parseError;
      }
    })
  })
  endpoint.method('tokenlon.getMarketMakerConfig', (ctx, _next) => {
    // test address on kovan network
    ctx.body = {
      "mmId": 1,
      "networkId": 3000,
      "erc20ProxyContractAddress": "0xf1ec01d6236d3cd881a0bf0130ea25fe4234003e",
      "exchangeContractAddress": "0x30589010550762d2f0d06f650d8e8b6ade6dbf4b",
      "forwarderContractAddress": "0xd85e2fa7e7e252b27b01bf0d65c946959d2f45b8",
      "zrxContractAddress": "0x2002d3812f58e35f0ea1ffbf80a75a38c32175fa",
      "tokenlonExchangeContractAddress": "0xc23dc48e847ea67cde9a93d0df242f9584abc90d",
      "wethContractAddress": "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
      "userProxyContractAddress": "0x97959853a0fb9a28432f1d4f46654fe524a12d81",
      "orderExpirationSeconds": 600,
      "mmProxyContractAddress": "0x974afc6906cdeb17f163b7a5a2d2a59aa488b94e",
      "feeFactor": 30
    }
  })
  endpoint.method('auth.getMMJwtToken', (ctx, _next) => {
    ctx.body = "TODO"
  })

  endpoint.method('tokenlon.getTokenList', (ctx, _next) => {
    ctx.body = [
      {
        "symbol": "ETH",
        "logo": "https://cdn.example.com/mainnet-production/tokens/icons/eth%403x.png",
        "contractAddress": "0x0000000000000000000000000000000000000000",
        "decimal": 18,
        "precision": 4,
        "minTradeAmount": 1E-7,
        "maxTradeAmount": 1E+1
      },
      {
        "symbol": "DAI",
        "logo": "https://cdn.example.com/mainnet-production/exchange-pairs/DAI.png",
        "contractAddress": "0x5c964665b6379527b625be996020d861f27aa31d",
        "decimal": 18,
        "precision": 4,
        "minTradeAmount": 0.001,
        "maxTradeAmount": 1E+4
      }]
  })

  endpoint.method('tokenlon.getTokenConfigsForMM', (ctx, _next) => {
    ctx.body = [
      {
        "symbol": "ETH",
        "feeFactor": 30
      },
      {
        "symbol": "DAI",
        "feeFactor": 30
      }
    ]
  })

  endpoint.method('tokenlon.getOrdersHistoryForMM', (ctx, _next) => {
    ctx.body = "TODO"
  })

  endpoint.method('tokenlon.getOrderStateForMM', (ctx, _next) => {
    ctx.body = "TODO"
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
app
  .use(BodyParser())
  .use(logger())
  .use(router.routes())
  .use(router.allowedMethods())
app.listen(8088)
