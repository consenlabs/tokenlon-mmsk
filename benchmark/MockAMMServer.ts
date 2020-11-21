import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as BodyParser from 'koa-bodyparser'
import * as logger from 'koa-logger'
import * as JsonRPC from '@koalex/koa-json-rpc'
import BigNumber from 'bignumber.js'
import * as ethers from 'ethers'
import * as _ from 'lodash'
import * as uuid from 'uuid'

require('dotenv').config()
const AMMWrapper = require('../abi/AMMWrapper.json')

// mainnet
// const UNISWAP_V1_FACTORY_ADDRESS = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95'.toLowerCase();
// const UNISWAP_V2_ROUTER_02_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase();
// const CURVE_COMPOUND_ADDRESS = '0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56'.toLowerCase();
// const CURVE_USDT_ADDRESS = '0x52EA46506B9CC5Ef470C5bf89f17Dc28bB35D85C'.toLowerCase();
// const CURVE_Y_ADDRESS = '0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51'.toLowerCase()

// kovan testnet
const UNISWAP_V1_FACTORY_ADDRESS = '0xD3E51Ef092B2845f10401a0159B2B96e8B6c3D30'.toLowerCase();
const UNISWAP_V2_ROUTER_02_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase();

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const providerUrl = process.env.PROVIDER_URL
const ammWrapperAddress = process.env.AMMWRAPPER_CONTRACT_ADDRESS
const provider = new ethers.providers.JsonRpcProvider(providerUrl)

const ammWrapper = new ethers.Contract(ammWrapperAddress, AMMWrapper.abi, provider)
const allPools = [
  UNISWAP_V1_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_02_ADDRESS,
  // CURVE_COMPOUND_ADDRESS,
  // CURVE_USDT_ADDRESS,
  // CURVE_Y_ADDRESS,
]

// mainnet
// const addressMap = {
//   ETH: {
//     address: '0x0000000000000000000000000000000000000000',
//     decimal: 18,
//   },
//   DAI: {
//     address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
//     decimal: 18,
//   },
//   USDT: {
//     address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
//     decimal: 6,
//   },
//   USDC: {
//     address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
//     decimal: 6,
//   },
//   TUSD: {
//     address: '0x0000000000085d4780B73119b644AE5ecd22b376',
//     decimal: 18,
//   },
//   UNI: {
//     address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
//     decimal: 18,
//   },
//   YFI: {
//     address: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
//     decimal: 18,
//   },
// }

// kovan testnet
const addressMap = {
  ETH: {
    address: '0x0000000000000000000000000000000000000000',
    decimal: 18,
  },
  DAI: {
    address: '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
    decimal: 18,
  },
  USDT: {
    address: '0x07de306ff27a2b630b1141956844eb1552b956b5',
    decimal: 6,
  },
  USDC: {
    address: '0xb7a4f3e9097c08da09517b5ab877f7a917224ede',
    decimal: 6,
  },
  // TUSD: {
  //   address: '0x0000000000085d4780B73119b644AE5ecd22b376',
  //   decimal: 18,
  // },
  UNI: {
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    decimal: 18,
  },
  // YFI: {
  //   address: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
  //   decimal: 18,
  // },
}

const getAssetAddress = (assetName: string): any => {
  const assetNameUpperCase = assetName.toUpperCase()
  return addressMap[assetNameUpperCase]
}

// mainnet
// const registeredTokens = {}
// registeredTokens[UNISWAP_V1_FACTORY_ADDRESS] = ['ETH', 'DAI', 'USDC', 'TUSD']
// registeredTokens[UNISWAP_V2_ROUTER_02_ADDRESS] = [
//   'ETH',
//   'DAI',
//   'USDT',
//   'USDC',
//   'TUSD',
//   'UNI',
//   'YFI',
// ]
// registeredTokens[CURVE_COMPOUND_ADDRESS] = ['DAI', 'USDC']
// registeredTokens[CURVE_USDT_ADDRESS] = ['DAI', 'USDC', 'USDT']
// registeredTokens[CURVE_Y_ADDRESS] = ['DAI', 'USDC', 'USDT', 'TUSD']

// kovan
const registeredTokens = {}
registeredTokens[UNISWAP_V1_FACTORY_ADDRESS] = ['ETH', 'DAI', 'USDC']
registeredTokens[UNISWAP_V2_ROUTER_02_ADDRESS] = [
  'ETH',
  'DAI',
  'USDT',
  'USDC',
  // 'TUSD',
  'UNI',
  // 'YFI',
]

function filterPools(base, quote: string): string[] {
  const qualifiedPools = allPools.filter((pool) => {
    return registeredTokens[pool].includes(base) && registeredTokens[pool].includes(quote)
  })
  return qualifiedPools
}

function generatePairs(poolTokens): string[] {
  const pairs = []
  for (let i = 0; i < poolTokens.length; i++) {
    for (let j = 0; j < poolTokens.length; j++) {
      if (poolTokens[i] !== poolTokens[j]) {
        pairs.push(`${poolTokens[i]}/${poolTokens[j]}`)
        pairs.push(`${poolTokens[j]}/${poolTokens[i]}`)
      }
    }
  }
  return pairs
}

function generateAllPairs(): string[] {
  const allPoolPairs = allPools
    .map((pool) => registeredTokens[pool])
    .map((poolRegisteredTokens) => generatePairs(poolRegisteredTokens))
    .reduce((acc, cur) => acc.concat(cur), [])
  return _.uniq(allPoolPairs)
}

const getBestPrice = async (side, base, quote, amount): Promise<any> => {
  const pair = side === 'SELL' ? `${base}/${quote}` : `${quote}/${base}`
  console.log(pair)
  const baseAmount = new BigNumber(amount.toString())
  const baseToken = getAssetAddress(base)
  const quoteToken = getAssetAddress(quote)
  let price = 0
  let expectedAmount = 0
  let bestMaker = ZERO_ADDRESS
  const pools = filterPools(base, quote)

  if (side === 'SELL') {
    const resp = await ammWrapper.getBestOutAmount(
      pools,
      baseToken.address,
      quoteToken.address,
      ethers.utils.parseUnits(baseAmount.toString(), baseToken.decimal)
    )
    bestMaker = resp.bestMaker
    const inAmount = baseAmount
    const outAmount = ethers.utils.formatUnits(resp.bestAmount, quoteToken.decimal)
    price = new BigNumber(outAmount).dividedBy(inAmount).toNumber()
    expectedAmount = new BigNumber(outAmount).toNumber()
  } else if (side === 'BUY') {
    const resp = await ammWrapper.getBestInAmount(
      pools,
      quoteToken.address,
      baseToken.address,
      ethers.utils.parseUnits(baseAmount.toString(), baseToken.decimal)
    )
    bestMaker = resp.bestMaker
    const inAmount = ethers.utils.formatUnits(resp.bestAmount, quoteToken.decimal)
    const outAmount = baseAmount
    price = new BigNumber(outAmount).dividedBy(inAmount).toNumber()
    expectedAmount = new BigNumber(inAmount).toNumber()
  } else {
    throw new Error('Unsupported side')
  }
  console.log(expectedAmount)
  console.log(bestMaker)
  return {
    price: price,
    expectedAmount: expectedAmount,
    makerAddress: bestMaker,
  }
}

function makeMarketMakerRounter(): Router {
  const router = new Router()
  router.get('/pairs', function (ctx, _next) {
    ctx.body = {
      result: true,
      pairs: generateAllPairs(),
    }
  })
  router.get('/indicativePrice', async (ctx, _next) => {
    const { side, base, quote, amount } = ctx.query
    try {
      const { price, expectedAmount, makerAddress } = await getBestPrice(side, base, quote, amount)
      if (makerAddress !== ZERO_ADDRESS) {
        ctx.body = {
          result: true,
          exchangeable: true,
          price: price,
          minAmount: 0.002,
          maxAmount: new BigNumber(amount).toNumber(),
          expectedAmount: expectedAmount,
          makerAddress: makerAddress,
        }
      } else {
        throw new Error('Unsupported pair')
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        result: false,
        exchangeable: false,
        price: 0,
        minAmount: 0,
        maxAmount: 0,
      }
    }
  })
  router.get('/price', async (ctx, _next) => {
    const { side, base, quote, amount } = ctx.query
    try {
      const { price, expectedAmount, makerAddress } = await getBestPrice(side, base, quote, amount)
      if (makerAddress !== ZERO_ADDRESS) {
        ctx.body = {
          result: true,
          exchangeable: true,
          price: price,
          minAmount: 0.002,
          maxAmount: new BigNumber(amount).toNumber(),
          expectedAmount: expectedAmount,
          makerAddress: makerAddress,
          quoteId: uuid.v4(),
        }
      } else {
        throw new Error('Unsupported pair')
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        result: false,
        exchangeable: false,
        price: 0,
        minAmount: 0,
        maxAmount: 0,
      }
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
      {
        symbol: 'USDT',
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimal: 6,
        precision: 6,
        minTradeAmount: 0.001,
        maxTradeAmount: 1e7,
      },
      {
        symbol: 'USDC',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimal: 6,
        precision: 6,
        minTradeAmount: 0.001,
        maxTradeAmount: 1e7,
      },
      {
        symbol: 'TUSD',
        contractAddress: '0x0000000000085d4780B73119b644AE5ecd22b376',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.001,
        maxTradeAmount: 1e7,
      },
      {
        symbol: 'UNI',
        contractAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.001,
        maxTradeAmount: 2e3,
      },
      {
        symbol: 'YFI',
        contractAddress: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
        decimal: 18,
        precision: 6,
        minTradeAmount: 0.001,
        maxTradeAmount: 1e1,
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
