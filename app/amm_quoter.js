'use strict'

const BigNumber = require('bignumber.js')
const ethers = require('ethers')
const _ = require('lodash')
const uuid = require('uuid')
const AMMWrapper = require('../abi/AMMWrapper.json')

const UNISWAP_V1_FACTORY_ADDRESS = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95'.toLowerCase();
const UNISWAP_V2_ROUTER_02_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase();
const CURVE_COMPOUND_ADDRESS = '0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56'.toLowerCase();
const CURVE_USDT_ADDRESS = '0x52EA46506B9CC5Ef470C5bf89f17Dc28bB35D85C'.toLowerCase();
const CURVE_Y_ADDRESS = '0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51'.toLowerCase()

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const allPools = [
  UNISWAP_V1_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_02_ADDRESS,
  CURVE_COMPOUND_ADDRESS,
  CURVE_USDT_ADDRESS,
  CURVE_Y_ADDRESS,
]

const getAssetAddress = (assetName) => {
  const assetNameUpperCase = assetName.toUpperCase()
  const addressMap = {
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      decimal: 18,
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimal: 18,
    },
    USDT: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimal: 6,
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimal: 6,
    },
    TUSD: {
      address: '0x0000000000085d4780B73119b644AE5ecd22b376',
      decimal: 18,
    },
    UNI: {
      address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      decimal: 18,
    },
    YFI: {
      address: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
      decimal: 18,
    },
  }
  return addressMap[assetNameUpperCase]
}

const registeredTokens = {}
registeredTokens[UNISWAP_V1_FACTORY_ADDRESS] = ['ETH', 'DAI', 'USDC', 'TUSD']
registeredTokens[UNISWAP_V2_ROUTER_02_ADDRESS] = [
  'ETH',
  'DAI',
  'USDT',
  'USDC',
  'TUSD',
  'UNI',
  'YFI',
]
registeredTokens[CURVE_COMPOUND_ADDRESS] = ['DAI', 'USDC']
registeredTokens[CURVE_USDT_ADDRESS] = ['DAI', 'USDC', 'USDT']
registeredTokens[CURVE_Y_ADDRESS] = ['DAI', 'USDC', 'USDT', 'TUSD']

function filterPools(base, quote) {
  const qualifiedPools = allPools.filter((pool) => {
    return registeredTokens[pool].includes(base) && registeredTokens[pool].includes(quote)
  })
  return qualifiedPools
}

function generatePairs(poolTokens) {
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

function generateAllPairs() {
  const allPoolPairs = allPools
    .map((pool) => registeredTokens[pool])
    .map((poolRegisteredTokens) => generatePairs(poolRegisteredTokens))
    .reduce((acc, cur) => acc.concat(cur), [])
  return _.uniq(allPoolPairs)
}

const allPairs = generateAllPairs()

class AMMQuoter {
  constructor(providerUrl, ammWrapperAddress) {
    const provider = new ethers.providers.JsonRpcProvider(providerUrl)
    this.ammWrapper = new ethers.Contract(ammWrapperAddress, AMMWrapper.abi, provider)
  }
  async getPairs() {
    return allPairs
  }

  async getIndicativePrice(data) {
    console.debug(`[QUOTER] handle indicative_price, order=${JSON.stringify(data)}`)
    const { side, base, quote, amount } = data
    const { price, expectedAmount, makerAddress } = await getBestPrice(side, base, quote, amount)
    if (makerAddress == ZERO_ADDRESS) {
      throw new Error('Unsupported pair')
    }

    return {
      result: true,
      exchangeable: true,
      price: price,
      minAmount: 0.002,
      maxAmount: new BigNumber(amount).toNumber(),
      expectedAmount: expectedAmount,
      makerAddress: makerAddress,
    }
  }

  async getPrice(data) {
    console.debug(`[QUOTER] handle price, order=${JSON.stringify(data)}`)
    const { side, base, quote, userAddr, amount } = data
    const { price, expectedAmount, makerAddress } = await getBestPrice(side, base, quote, amount)
    if (makerAddress == ZERO_ADDRESS) {
      throw new Error('Unsupported pair')
    }

    return {
      result: true,
      exchangeable: true,
      price: price,
      minAmount: 0.002,
      maxAmount: new BigNumber(amount).toNumber(),
      expectedAmount: expectedAmount,
      makerAddress: makerAddress,
      quoteId: uuid.v4(),
    }
  }

  async dealOrder(data) {
    console.debug(`[QUOTER] handle deal, order=${JSON.stringify(data)}`)
    return
  }

  async exceptionOrder(data) {
    console.debug(`[QUOTER] handle exception, order=${JSON.stringify(data)}`)
    return
  }

  async getBestPrice(side, base, quote, amount) {
    const pair = side === 'SELL' ? `${base}/${quote}` : `${quote}/${base}`
    const baseAmount = new BigNumber(amount.toString())
    const baseToken = getAssetAddress(base)
    const quoteToken = getAssetAddress(quote)
    let price = 0
    let expectedAmount = 0
    let bestMaker = ZERO_ADDRESS
    const pools = filterPools(base, quote)

    if (side === 'SELL') {
      const resp = await this.ammWrapper.getBestOutAmount(
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
      const resp = await this.ammWrapper.getBestInAmount(
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
    return {
      price: price,
      expectedAmount: expectedAmount,
      makerAddress: bestMaker,
    }
  }
}

module.exports = AMMQuoter
